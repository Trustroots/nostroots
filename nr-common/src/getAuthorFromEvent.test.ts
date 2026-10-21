import { expect } from "jsr:@std/expect";
import { getAuthorFromEvent } from "./getAuthorFromEvent.ts";

const PUBKEY = "a".repeat(64);
const ORIGINAL_AUTHOR = "b".repeat(64);
const plusCodeTags = [
  ["L", "open-location-code"],
  ["l", "9F4MGC22+22", "open-location-code"],
];

const makeEvent = (overrides: Record<string, unknown> = {}) => ({
  id: "c".repeat(64),
  pubkey: PUBKEY,
  sig: "d".repeat(128),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [] as string[][],
  content: "hello",
  ...overrides,
});

const makeRepost = (tags: string[][]) =>
  makeEvent({ kind: 30398, tags, content: "reposted" });

Deno.test("returns the signer of a generic event", () => {
  expect(getAuthorFromEvent(makeEvent())).toBe(PUBKEY);
});

Deno.test("returns the signer of a valid map note", () => {
  expect(
    getAuthorFromEvent(makeEvent({ kind: 30397, tags: plusCodeTags })),
  ).toBe(PUBKEY);
});

Deno.test("returns the original author of a valid repost", () => {
  const repost = makeRepost([...plusCodeTags, ["p", ORIGINAL_AUTHOR]]);
  expect(getAuthorFromEvent(repost)).toBe(ORIGINAL_AUTHOR);
});

Deno.test("returns undefined for a repost without a p tag", () => {
  expect(getAuthorFromEvent(makeRepost(plusCodeTags))).toBeUndefined();
});

Deno.test("returns undefined for a repost without a plus code", () => {
  const repost = makeRepost([["p", ORIGINAL_AUTHOR]]);
  expect(getAuthorFromEvent(repost)).toBeUndefined();
});

Deno.test("returns undefined for a map note without a plus code", () => {
  expect(getAuthorFromEvent(makeEvent({ kind: 30397 }))).toBeUndefined();
});

Deno.test("returns undefined for a malformed event", () => {
  expect(getAuthorFromEvent(makeEvent({ pubkey: "short" }))).toBeUndefined();
  expect(getAuthorFromEvent({} as never)).toBeUndefined();
});
