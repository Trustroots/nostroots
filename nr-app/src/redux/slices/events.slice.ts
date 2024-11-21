import { ID_SEPARATOR } from "@/constants";
import { Event } from "@common/mod";
import {
  createEntityAdapter,
  createSlice,
  PayloadAction,
} from "@reduxjs/toolkit";

type EventMetadata = {
  seenOnRelays: string[];
};
export type EventWithMetadata = {
  event: Event;
  metadata: EventMetadata;
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

export const eventsAdapter = createEntityAdapter<EventWithMetadata, string>({
  selectId: (model) => getStorageId(model.event),
});

const localSelectors = eventsAdapter.getSelectors();

export const _hasEventBeenSeenOnRelay = (
  eventWithMetadata: EventWithMetadata,
  relayUrl: string,
): boolean => {
  return eventWithMetadata.metadata.seenOnRelays.includes(relayUrl);
};

export const _addSeenOnRelayToMetadata = (
  metadata: EventMetadata,
  seenOnRelay: string,
): EventMetadata => {
  if (metadata.seenOnRelays.includes(seenOnRelay)) {
    return metadata;
  }
  const updatedSeenOnRelays = metadata.seenOnRelays.concat(seenOnRelay);
  const updatedMetadata = { ...metadata, seenOnRelay: updatedSeenOnRelays };
  return updatedMetadata;
};

export const eventsSlice = createSlice({
  name: "events",
  initialState: eventsAdapter.getInitialState(),
  reducers: {
    setAllEventsWithMetadata: (
      state,
      action: PayloadAction<EventWithMetadata[]>,
    ) => {
      eventsAdapter.setAll(state, action.payload);
    },
    addEvent: (
      state,
      action: PayloadAction<{ event: Event; fromRelay: string }>,
    ) => {
      const { event, fromRelay: seenOnRelay } = action.payload;
      const storageId = getStorageId(event);

      const eventWithMetadata = {
        event,
        metadata: {
          seenOnRelays: [seenOnRelay],
        },
      };

      const isExistingEvent = state.ids.includes(storageId);

      if (!isExistingEvent) {
        eventsAdapter.setOne(state, eventWithMetadata);
        return;
      }

      const existingEvent = localSelectors.selectById(state, storageId);

      if (existingEvent.event.id === event.id) {
        if (_hasEventBeenSeenOnRelay(existingEvent, seenOnRelay)) {
          return;
        }

        const updatedMetadata = _addSeenOnRelayToMetadata(
          existingEvent.metadata,
          seenOnRelay,
        );
        eventsAdapter.updateOne(state, {
          id: storageId,
          changes: {
            metadata: updatedMetadata,
          },
        });
        return;
      }

      const isUpdatedVersionOfEvent =
        event.created_at > existingEvent.event.created_at;

      if (isUpdatedVersionOfEvent) {
        eventsAdapter.setOne(state, eventWithMetadata);
        return;
      }
    },
  },
});

export const { addEvent, setAllEventsWithMetadata } = eventsSlice.actions;

export const eventsSelectors = eventsAdapter.getSelectors(
  eventsSlice.selectSlice,
);
