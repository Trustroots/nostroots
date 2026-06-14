import {
  Event,
  getPlusCodeAndPlusCodePrefixTags,
  MAP_NOTE_REPOST_KIND,
  TRUSTROOTS_PROFILE_KIND,
} from "@trustroots/nr-common";

import { EventWithMetadata } from "@/redux/slices/events.slice";

export const TEST_PUBKEY =
  "1111111111111111111111111111111111111111111111111111111111111111";
export const TEST_RELAY = "wss://relay.example";
export const TEST_PLUS_CODE = "9F4M0000+";

function hex(seed: string, length: number): string {
  return seed.repeat(length).slice(0, length);
}

export function createNostrEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: hex("a", 64),
    pubkey: TEST_PUBKEY,
    created_at: 1_800_000_000,
    kind: MAP_NOTE_REPOST_KIND,
    tags: getPlusCodeAndPlusCodePrefixTags(TEST_PLUS_CODE),
    content: "A useful map note",
    sig: hex("b", 128),
    ...overrides,
  };
}

export function createEventWithMetadata(
  overrides: Partial<Event> = {},
): EventWithMetadata {
  return {
    event: createNostrEvent(overrides),
    metadata: {
      seenOnRelays: [TEST_RELAY],
    },
  };
}

export function createMapNote(
  overrides: Partial<Event> = {},
): EventWithMetadata {
  return createEventWithMetadata({
    kind: MAP_NOTE_REPOST_KIND,
    ...overrides,
  });
}

export function createProfileEvent({
  username = "alice",
  pubkey = TEST_PUBKEY,
}: {
  username?: string;
  pubkey?: string;
} = {}): EventWithMetadata {
  return createEventWithMetadata({
    id: hex("c", 64),
    pubkey,
    kind: TRUSTROOTS_PROFILE_KIND,
    content: JSON.stringify({ name: username }),
    tags: [
      ["L", "org.trustroots:username"],
      ["l", username, "org.trustroots:username"],
    ],
  });
}
