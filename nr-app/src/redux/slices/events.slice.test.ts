import { NOSTR_EXPIRATION_TAG_NAME } from "@trustroots/nr-common";

import {
  addEvent,
  eventsActions,
  eventsSelectors,
  eventsSlice,
} from "./events.slice";

function event(
  overrides: Partial<Parameters<typeof addEvent>[0]["payload"]["event"]> = {},
) {
  return {
    content: "",
    created_at: 100,
    id: "0".repeat(64),
    kind: 1,
    pubkey: "1".repeat(64),
    sig: "2".repeat(128),
    tags: [],
    ...overrides,
  };
}

describe("events.slice", () => {
  it("adds valid events with relay metadata", () => {
    const state = eventsSlice.reducer(
      eventsSlice.getInitialState(),
      addEvent({ event: event(), fromRelay: "wss://relay.example" }),
    );

    expect(eventsSelectors.selectAll({ events: state } as never)).toHaveLength(
      1,
    );
    expect(
      eventsSelectors.selectAll({ events: state } as never)[0].metadata,
    ).toEqual({
      seenOnRelays: ["wss://relay.example"],
    });
  });

  it("ignores invalid events", () => {
    const state = eventsSlice.reducer(
      eventsSlice.getInitialState(),
      addEvent({
        event: event({ id: "not-hex" }) as ReturnType<typeof event>,
        fromRelay: "wss://relay.example",
      }),
    );

    expect(eventsSelectors.selectAll({ events: state } as never)).toHaveLength(
      0,
    );
  });

  it("flushes expired events", () => {
    const unexpired = event({ id: "1".repeat(64) });
    const expired = event({
      id: "2".repeat(64),
      tags: [[NOSTR_EXPIRATION_TAG_NAME, "10"]],
    });
    const withEvents = eventsSlice.reducer(
      eventsSlice.getInitialState(),
      eventsActions.addEvents({
        events: [unexpired, expired],
        fromRelay: "wss://relay.example",
      }),
    );

    const flushed = eventsSlice.reducer(
      withEvents,
      eventsActions.flushExpiredEvents({ currentTimestampSeconds: 11 }),
    );

    expect(
      eventsSelectors
        .selectAll({ events: flushed } as never)
        .map(({ event }) => event.id),
    ).toEqual([unexpired.id]);
  });
});
