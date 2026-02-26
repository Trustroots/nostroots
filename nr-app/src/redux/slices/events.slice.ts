import { ID_SEPARATOR } from "@/constants";
import {
  isEventForPlusCodeExactly,
  isEventWithinThisPlusCode,
} from "@/utils/event.utils";
import { rootLogger } from "@/utils/logger.utils";
import {
  createEntityAdapter,
  createSelector,
  createSlice,
  PayloadAction,
} from "@reduxjs/toolkit";
import {
  Event,
  eventSchema,
  getFirstTagValueFromEvent,
  getTrustrootsUsernameFromProfileEvent,
  isEphemeralKind,
  MAP_NOTE_REPOST_KIND,
  NOSTR_EXPIRATION_TAG_NAME,
  TRUSTROOTS_PROFILE_KIND,
} from "@trustroots/nr-common";
import { Filter, matchFilter } from "nostr-tools";

const log = rootLogger.extend("events.slice");

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

function addEventToState(
  state: ReturnType<typeof eventsAdapter.getInitialState>,
  event: Event,
  seenOnRelay: string,
) {
  // Skip ephemeral events (kind 20000-29999) — they are handled by sagas
  // directly and should not be persisted in the store.
  if (isEphemeralKind(event.kind)) {
    return;
  }

  // Skip events which don't pass validation
  const validationResult = eventSchema.safeParse(event);
  if (!validationResult.success) {
    log.debug(
      "#dGBJqf Skipping event that fails validation",
      event,
      validationResult,
    );
    return;
  }

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
}

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
      addEventToState(state, event, seenOnRelay);
    },
    addEvents: (
      state,
      action: PayloadAction<{ events: Event[]; fromRelay: string }>,
    ) => {
      const { events, fromRelay: seenOnRelay } = action.payload;

      events.forEach((event) => {
        addEventToState(state, event, seenOnRelay);
      });
    },
    flushExpiredEvents: (
      state,
      action: PayloadAction<{ currentTimestampSeconds: number }>,
    ) => {
      const { currentTimestampSeconds } = action.payload;
      const originalEvents = eventsAdapter.getSelectors().selectAll(state);
      const eventsToKeep = originalEvents.filter((event) => {
        const expirationString = getFirstTagValueFromEvent(
          event.event,
          NOSTR_EXPIRATION_TAG_NAME,
        );
        if (typeof expirationString === "string") {
          const expiration = parseInt(expirationString);
          if (expiration <= currentTimestampSeconds) {
            return false;
          }
        }
        return true;
      });
      eventsAdapter.setAll(state, eventsToKeep);
    },
  },
});

export const { addEvent, addEvents, setAllEventsWithMetadata } =
  eventsSlice.actions;

export const eventsActions = eventsSlice.actions;

const adapterSelectors = eventsAdapter.getSelectors();

const selectAll = createSelector(
  eventsSlice.selectSlice,
  adapterSelectors.selectAll,
);

const selectEventsForPlusCodeExactlyFactory = (plusCode: string) =>
  createSelector([selectAll], (events) =>
    events.filter((event) => isEventForPlusCodeExactly(event.event, plusCode)),
  );

const selectEventsWithinPlusCodeFactory = (plusCode: string) =>
  createSelector([selectAll], (events) =>
    events.filter(
      (event) =>
        !isEventForPlusCodeExactly(event.event, plusCode) &&
        isEventWithinThisPlusCode(event.event, plusCode),
    ),
  );

const selectAuthorProfileEventFactory = (authorPublicKey?: string) =>
  createSelector([selectAll], (events) => {
    if (
      typeof authorPublicKey === "undefined" ||
      authorPublicKey.length === 0
    ) {
      return;
    }
    const authorFilter: Filter = {
      authors: [authorPublicKey],
      kinds: [TRUSTROOTS_PROFILE_KIND],
    };
    const profileEvent = events.find((eventWithMetdata) =>
      matchFilter(authorFilter, eventWithMetdata.event),
    );
    return profileEvent;
  });

const selectTrustrootsUsernameFactory = (authorPublicKey?: string) =>
  createSelector(
    [selectAuthorProfileEventFactory(authorPublicKey)],
    (profileEvent) => {
      if (typeof profileEvent === "undefined") {
        return;
      }
      const username = getTrustrootsUsernameFromProfileEvent(
        profileEvent.event,
      );
      return username;
    },
  );

const selectMapNotes = createSelector([selectAll], (events) =>
  events.filter((event) => event.event.kind === MAP_NOTE_REPOST_KIND),
);

const selectEventsSortedByTimeFactory = (order: "newest" | "oldest") =>
  createSelector([selectAll], (events) =>
    [...events].sort((a, b) =>
      order === "newest"
        ? b.event.created_at - a.event.created_at
        : a.event.created_at - b.event.created_at,
    ),
  );

export const eventsSelectors = {
  selectAll,
  selectEventsForPlusCodeExactlyFactory,
  selectEventsWithinPlusCodeFactory,
  selectAuthorProfileEventFactory,
  selectTrustrootsUsernameFactory,
  selectMapNotes,
  selectEventsSortedByTimeFactory,
};
