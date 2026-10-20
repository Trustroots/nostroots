import { expect } from "jsr:@std/expect";
import { getAuthorFromEvent } from "./getAuthorFromEvent.ts";
import {
  makeEvent,
  makeMapNote,
  makeRepost,
  ORIGINAL_AUTHOR_PUBKEY,
  plusCodeTags,
  PUBKEY,
} from "./testEvents.ts";

Deno.test("getAuthorFromEvent returns the signer of a map note", () => {
  expect(getAuthorFromEvent(makeMapNote())).toBe(PUBKEY);
});

Deno.test("getAuthorFromEvent returns the signer of a generic event", () => {
  expect(getAuthorFromEvent(makeEvent())).toBe(PUBKEY);
});

Deno.test("getAuthorFromEvent returns the original author of a repost", () => {
  expect(getAuthorFromEvent(makeRepost())).toBe(ORIGINAL_AUTHOR_PUBKEY);
});

Deno.test("getAuthorFromEvent uses the first p tag of a repost", () => {
  const tags = [
    ...plusCodeTags,
    ["p", ORIGINAL_AUTHOR_PUBKEY],
    ["p", "e".repeat(64)],
  ];
  expect(getAuthorFromEvent(makeRepost({ tags }))).toBe(ORIGINAL_AUTHOR_PUBKEY);
});

Deno.test("getAuthorFromEvent returns undefined for a repost without a p tag", () => {
  expect(getAuthorFromEvent(makeRepost({ tags: plusCodeTags })))
    .toBeUndefined();
});

Deno.test("getAuthorFromEvent returns undefined for a malformed event", () => {
  expect(getAuthorFromEvent(makeEvent({ pubkey: "short" }))).toBeUndefined();
  expect(getAuthorFromEvent(makeEvent({ extra: "field" }))).toBeUndefined();
  expect(getAuthorFromEvent({} as never)).toBeUndefined();
});

// eventSchema is `kindSpecificEventSchema.or(baseEventSchema)`, and the base
// schema accepts any kind, so a repost that fails its kind-specific schema
// (here: no plus code) still validates and has its author resolved.
Deno.test("getAuthorFromEvent resolves the author of a repost with an invalid plus code", () => {
  const repost = makeRepost({ tags: [["p", ORIGINAL_AUTHOR_PUBKEY]] });
  expect(getAuthorFromEvent(repost)).toBe(ORIGINAL_AUTHOR_PUBKEY);
});
