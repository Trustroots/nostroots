import { ID_SEPARATOR } from "@/constants";
import { Event } from "@common/mod";
import {
  createEntityAdapter,
  createSlice,
  PayloadAction,
} from "@reduxjs/toolkit";
import { RootState } from "./store";

export const SLICE_NAME = "events" as const;

type NostrEventWithMetadata = {
  event: Event;
  metadata: {
    seenOnRelays: string[];
  };
};

function getStorageId(nostrEvent: Event) {
  const { id, kind, pubkey } = nostrEvent;

  // Replaceable events
  if (kind === 0 || (kind >= 10e3 && kind < 20e3)) {
    return [pubkey, kind].join(ID_SEPARATOR);
  }

  // Parameterized replaceable events
  if (kind >= 30e3 && kind < 40e3) {
    const dTag = nostrEvent.tags.find(([tagName]) => tagName === "d");
    if (typeof dTag !== "undefined") {
      const [, tagValue] = dTag;
      const storageId = [pubkey, kind, tagValue].join(ID_SEPARATOR);
      return storageId;
    }
  }

  return id;
}

export const eventsAdapter = createEntityAdapter<
  NostrEventWithMetadata,
  string
>({
  selectId: (model) => getStorageId(model.event),
});

const localSelectors = eventsAdapter.getSelectors();

export const eventsSlice = createSlice({
  name: SLICE_NAME,
  initialState: eventsAdapter.getInitialState(),
  reducers: {
    setAllEvents: (state, action: PayloadAction<Event[]>) => {
      const eventsWithMetadata = action.payload.map(
        (event): NostrEventWithMetadata => ({
          event,
          metadata: { seenOnRelays: [] },
        }),
      );
      eventsAdapter.setAll(state, eventsWithMetadata);
    },
    addEvent: (
      state,
      action: PayloadAction<{ event: Event; fromRelay: string }>,
    ) => {
      const { event, fromRelay } = action.payload;
      const id = getStorageId(event);

      const isExistingEvent = state.ids.includes(id);

      if (!isExistingEvent) {
        const eventWithMetadata = {
          event,
          metadata: {
            seenOnRelays: [fromRelay],
          },
        };
        eventsAdapter.setOne(state, eventWithMetadata);
        return;
      }

      const existingEvent = localSelectors.selectById(state, id);

      if (existingEvent.event.id === event.id) {
        if (existingEvent.metadata.seenOnRelays.includes(fromRelay)) {
          return;
        }
        const metadata = {
          ...existingEvent.metadata,
          seenOnRelays: existingEvent.metadata.seenOnRelays.includes(fromRelay)
            ? existingEvent.metadata.seenOnRelays
            : existingEvent.metadata.seenOnRelays.concat(fromRelay),
        };
        eventsAdapter.updateOne(state, {
          id,
          changes: {
            metadata,
          },
        });
        return;
      }

      if (event.created_at > existingEvent.event.created_at) {
        const eventWithMetadata = {
          event,
          metadata: {
            seenOnRelays: [fromRelay],
          },
        };
        eventsAdapter.setOne(state, eventWithMetadata);
        return;
      }
    },
  },
});

export default eventsSlice.reducer;

export const { addEvent, setAllEvents } = eventsSlice.actions;

export const eventsSelectors = eventsAdapter.getSelectors(
  (state: RootState) => state[SLICE_NAME],
);
