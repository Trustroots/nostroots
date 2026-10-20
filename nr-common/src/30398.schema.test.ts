import { expect } from "jsr:@std/expect";
import {
  CONTENT_MAXIMUM_LENGTH,
  CONTENT_MINIMUM_LENGTH,
} from "../constants.ts";
import { kind30398EventSchema } from "./30398.schema.ts";
import { makeEvent, makeMapNote, makeRepost } from "./testEvents.ts";

const parses = (event: unknown) =>
  kind30398EventSchema.safeParse(event).success;

Deno.test("kind 30398 accepts a repost with a plus code and original author", () => {
  expect(parses(makeRepost())).toBe(true);
});

Deno.test("kind 30398 accepts a repost without a p tag", () => {
  expect(parses(makeRepost({ tags: makeMapNote().tags }))).toBe(true);
});

Deno.test("kind 30398 rejects another kind", () => {
  expect(parses(makeRepost({ kind: 30397 }))).toBe(false);
  expect(parses(makeEvent())).toBe(false);
});

Deno.test("kind 30398 rejects tags without a plus code", () => {
  expect(parses(makeRepost({ tags: [["p", "b".repeat(64)]] }))).toBe(false);
});

Deno.test("kind 30398 rejects an invalid plus code", () => {
  const tags = [
    ["L", "open-location-code"],
    ["l", "9F4MGC22+2", "open-location-code"],
  ];
  expect(parses(makeRepost({ tags }))).toBe(false);
});

Deno.test("kind 30398 enforces content length bounds", () => {
  expect(parses(makeRepost({ content: "a".repeat(CONTENT_MINIMUM_LENGTH) })))
    .toBe(true);
  expect(
    parses(makeRepost({ content: "a".repeat(CONTENT_MINIMUM_LENGTH - 1) })),
  ).toBe(false);
  expect(
    parses(makeRepost({ content: "a".repeat(CONTENT_MAXIMUM_LENGTH) })),
  ).toBe(true);
  expect(
    parses(makeRepost({ content: "a".repeat(CONTENT_MAXIMUM_LENGTH + 1) })),
  ).toBe(false);
});

Deno.test("kind 30398 rejects unfinalized events and unknown fields", () => {
  const { sig: _sig, ...withoutSig } = makeRepost();
  expect(parses(withoutSig)).toBe(false);
  expect(parses(makeRepost({ id: "short" }))).toBe(false);
  expect(parses(makeRepost({ extra: "field" }))).toBe(false);
});
