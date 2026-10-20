import {
  MAP_NOTE_KIND,
  MAP_NOTE_REPOST_KIND,
  NOTIFICATION_SERVER_PUBKEY,
  NOTIFICATION_SUBSCRIPTION_KIND,
  TRUSTROOTS_PROFILE_KIND,
} from "../constants.ts";

export const PUBKEY = "a".repeat(64);
export const ORIGINAL_AUTHOR_PUBKEY = "b".repeat(64);
export const EVENT_ID = "c".repeat(64);
export const PLUS_CODE = "9F4MGC22+22";

export const plusCodeTags = [
  ["L", "open-location-code"],
  ["l", PLUS_CODE, "open-location-code"],
];

export function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    pubkey: PUBKEY,
    sig: "d".repeat(128),
    created_at: 1_700_000_000,
    kind: 1,
    tags: [] as string[][],
    content: "hello",
    ...overrides,
  };
}

export const makeMapNote = (overrides: Record<string, unknown> = {}) =>
  makeEvent({
    kind: MAP_NOTE_KIND,
    tags: plusCodeTags,
    content: "A note on the map",
    ...overrides,
  });

export const makeRepost = (overrides: Record<string, unknown> = {}) =>
  makeEvent({
    kind: MAP_NOTE_REPOST_KIND,
    tags: [...plusCodeTags, ["p", ORIGINAL_AUTHOR_PUBKEY]],
    content: "A reposted note",
    ...overrides,
  });

export const makeSubscription = (overrides: Record<string, unknown> = {}) =>
  makeEvent({
    kind: NOTIFICATION_SUBSCRIPTION_KIND,
    tags: [["p", NOTIFICATION_SERVER_PUBKEY]],
    content: "encrypted-payload",
    ...overrides,
  });

export const makeProfile = (overrides: Record<string, unknown> = {}) =>
  makeEvent({
    kind: TRUSTROOTS_PROFILE_KIND,
    tags: [
      ["L", "org.trustroots:username"],
      ["l", "someuser", "org.trustroots:username"],
    ],
    content: "",
    ...overrides,
  });
