import { createMockVerifiedEvent } from "@/test/nostrMocks";
import {
  DEFAULT_RELAY_URL,
  TRUSTROOTS_PROFILE_KIND,
} from "@trustroots/nr-common";
import { call, fork, put } from "redux-saga/effects";
import { subscribeToFilter } from "@/nostr/subscriptions.nostr";
import {
  startSubscription,
  stopSubscription,
} from "../actions/subscription.actions";
import { addEvent } from "../slices/events.slice";
import { setSubscription } from "../slices/relays.slice";
import {
  getRelayUrlsOrDefaults,
  startSubscriptionSagaEffect,
  stopSubscriptionSagaEffect,
  subscribeToUserProfilesSagaEffect,
} from "./subscriptions.saga";

describe("subscriptions.saga", () => {
  it("uses the default relay when no explicit relays are provided", () => {
    expect(getRelayUrlsOrDefaults()).toEqual([DEFAULT_RELAY_URL]);
    expect(getRelayUrlsOrDefaults([])).toEqual([DEFAULT_RELAY_URL]);
    expect(getRelayUrlsOrDefaults(["wss://relay.example"])).toEqual([
      "wss://relay.example",
    ]);
  });

  it("replaces a named subscription on each requested relay", () => {
    const filters = [{ kinds: [1] }];
    const generator = startSubscriptionSagaEffect(
      startSubscription({
        id: "notes",
        filters,
        relayUrls: ["wss://one.example", "wss://two.example"],
      }),
    );

    expect(generator.next().value).toEqual(call(stopSubscription, "notes"));
    expect(generator.next().value).toEqual(
      put(
        setSubscription({
          subscriptionId: "notes",
          query: filters,
          relaysStatus: {
            "wss://one.example": { hasSeenEOSE: false, isOpen: false },
            "wss://two.example": { hasSeenEOSE: false, isOpen: false },
          },
        }),
      ),
    );
    expect(generator.next().value).toEqual(
      fork(subscribeToFilter, {
        filters,
        relayUrl: "wss://one.example",
        subscriptionId: "notes",
      }),
    );
    expect(generator.next().value).toEqual(
      fork(subscribeToFilter, {
        filters,
        relayUrl: "wss://two.example",
        subscriptionId: "notes",
      }),
    );
    expect(generator.next().done).toBe(true);
  });

  it("generates an id for an unnamed default-relay subscription", () => {
    const filters = [{ kinds: [1] }];
    const generator = startSubscriptionSagaEffect(
      startSubscription({ filters }),
    );
    const first = generator.next().value as ReturnType<typeof put>;
    const subscriptionId = (first.payload.action.payload as any).subscriptionId;

    expect(subscriptionId).toEqual(expect.any(String));
    expect(first.payload.action.payload.relaysStatus).toEqual({
      [DEFAULT_RELAY_URL]: { hasSeenEOSE: false, isOpen: false },
    });
    expect(generator.next().value).toEqual(
      fork(subscribeToFilter, {
        filters,
        relayUrl: DEFAULT_RELAY_URL,
        subscriptionId,
      }),
    );
  });

  it("closes a running subscription", () => {
    const generator = stopSubscriptionSagaEffect(stopSubscription("notes"));
    const close = jest.fn();

    expect(generator.next().value).toMatchObject({ type: "CALL" });
    expect(generator.next({ close } as any).value).toEqual(call(close));
    expect(generator.next().done).toBe(true);
  });

  it("stops the author subscription when no authors remain", () => {
    const generator = subscribeToUserProfilesSagaEffect(
      addEvent({ event: createMockVerifiedEvent(), fromRelay: "relay" }),
    );
    expect(generator.next().value).toMatchObject({ type: "SELECT" });
    expect(
      generator.next({
        eventsWithMetadata: [],
        existingSubscription: undefined,
      }).value,
    ).toEqual(put(stopSubscription("authorSubscription")));
  });

  it("subscribes to every unique event author", () => {
    const alice = createMockVerifiedEvent({ pubkey: "a".repeat(64) });
    const bob = createMockVerifiedEvent({ pubkey: "b".repeat(64) });
    const generator = subscribeToUserProfilesSagaEffect(
      addEvent({ event: alice, fromRelay: "relay" }),
    );
    generator.next();

    expect(
      generator.next({
        eventsWithMetadata: [alice, alice, bob].map((event) => ({
          event,
          metadata: { seenOnRelays: ["relay"] },
        })),
        existingSubscription: undefined,
      }).value,
    ).toEqual(
      put(
        startSubscription({
          filters: [
            {
              kinds: [TRUSTROOTS_PROFILE_KIND],
              authors: [alice.pubkey, bob.pubkey],
            },
          ],
          id: "authorSubscription",
        }),
      ),
    );
  });

  it("keeps an existing author subscription when it is complete", () => {
    const alice = createMockVerifiedEvent({ pubkey: "a".repeat(64) });
    const generator = subscribeToUserProfilesSagaEffect(
      addEvent({ event: alice, fromRelay: "relay" }),
    );
    generator.next();

    expect(
      generator.next({
        eventsWithMetadata: [
          { event: alice, metadata: { seenOnRelays: ["relay"] } },
        ],
        existingSubscription: {
          query: [{ authors: [alice.pubkey] }],
        },
      } as any).done,
    ).toBe(true);
  });
});
