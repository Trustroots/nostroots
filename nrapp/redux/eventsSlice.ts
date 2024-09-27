import { ID_SEPARATOR } from "@/constants";
import { Event } from "@/../nrcommon/mod";
import {
  createEntityAdapter,
  createSlice,
  PayloadAction,
} from "@reduxjs/toolkit";
import { RootState } from "./store";

export const SLICE_NAME = "events" as const;

function getStorageId(profileEvent: Event) {
  const { id, kind, pubkey } = profileEvent;

  // Replaceable events
  if (kind === 0 || (kind >= 10e3 && kind < 20e3)) {
    return [pubkey, kind].join(ID_SEPARATOR);
  }

  // Parameterized replaceable events
  if (kind >= 30e3 && kind < 40e3) {
    const dTag = profileEvent.tags.find(([tagName]) => tagName === "d");
    if (typeof dTag !== "undefined") {
      const [, tagValue] = dTag;
      const storageId = [pubkey, kind, tagValue].join(ID_SEPARATOR);
      return storageId;
    }
  }

  return id;
}

export const eventsAdapter = createEntityAdapter<Event, string>({
  selectId: getStorageId,
});

const localSelectors = eventsAdapter.getSelectors();

export const eventsSlice = createSlice({
  name: SLICE_NAME,
  initialState: eventsAdapter.getInitialState(),
  reducers: {
    setAllEvents: (state, action: PayloadAction<Event[]>) =>
      eventsAdapter.setAll(state, action.payload),
    addEvent: (state, action: PayloadAction<Event>) => {
      const event = action.payload;
      const id = getStorageId(event);

      const isExistingEvent = state.ids.includes(id);

      if (!isExistingEvent) {
        return eventsAdapter.setOne(state, event);
      }

      const existingEvent = localSelectors.selectById(state, id);

      if (event.created_at > existingEvent.created_at) {
        return eventsAdapter.setOne(state, event);
      }

      return state;
    },
  },
});

export default eventsSlice.reducer;

export const { addEvent, setAllEvents } = eventsSlice.actions;

export const eventsSelectors = eventsAdapter.getSelectors(
  (state: RootState) => state[SLICE_NAME],
);
