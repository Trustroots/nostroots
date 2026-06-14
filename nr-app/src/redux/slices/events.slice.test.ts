import { NOSTR_EXPIRATION_TAG_NAME } from "@trustroots/nr-common";

import { createMapNote } from "@/test/fixtures";
import {
  eventsActions,
  eventsSelectors,
  eventsSlice,
  setAllEventsWithMetadata,
} from "./events.slice";

describe("eventsSlice", () => {
  it("selects map notes and sorts them by time", () => {
    const oldNote = createMapNote({
      id: "1".repeat(64),
      created_at: 100,
      content: "older",
    });
    const newNote = createMapNote({
      id: "2".repeat(64),
      created_at: 200,
      content: "newer",
    });
    const state = {
      events: eventsSlice.reducer(
        undefined,
        setAllEventsWithMetadata([oldNote, newNote]),
      ),
    };

    expect(eventsSelectors.selectMapNotes(state)).toHaveLength(2);
    const sortedContents = eventsSelectors
      .selectEventsSortedByTimeFactory("newest")(state)
      .map(({ event }) => event.content);
    expect(sortedContents).toEqual(["newer", "older"]);
  });

  it("flushes expired events while preserving active events", () => {
    const expired = createMapNote({
      id: "3".repeat(64),
      tags: [[NOSTR_EXPIRATION_TAG_NAME, "99"]],
      content: "expired",
    });
    const active = createMapNote({
      id: "4".repeat(64),
      tags: [[NOSTR_EXPIRATION_TAG_NAME, "101"]],
      content: "active",
    });
    const loaded = eventsSlice.reducer(
      undefined,
      setAllEventsWithMetadata([expired, active]),
    );

    const flushed = eventsSlice.reducer(
      loaded,
      eventsActions.flushExpiredEvents({ currentTimestampSeconds: 100 }),
    );

    expect(eventsSelectors.selectAll({ events: flushed })).toHaveLength(1);
    expect(
      eventsSelectors.selectAll({ events: flushed })[0].event.content,
    ).toBe("active");
  });
});
