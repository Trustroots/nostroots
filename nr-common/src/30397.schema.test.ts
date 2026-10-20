import { expect } from "jsr:@std/expect";
import {
  CONTENT_MAXIMUM_LENGTH,
  CONTENT_MINIMUM_LENGTH,
} from "../constants.ts";
import { kind30397EventSchema } from "./30397.schema.ts";
import { makeEvent, makeMapNote, plusCodeTags } from "./testEvents.ts";

const parses = (event: unknown) =>
  kind30397EventSchema.safeParse(event).success;

Deno.test("kind 30397 accepts a note with a plus code", () => {
  expect(parses(makeMapNote())).toBe(true);
});

Deno.test("kind 30397 accepts additional tags next to the plus code", () => {
  expect(parses(makeMapNote({ tags: [...plusCodeTags, ["t", "hosting"]] })))
    .toBe(true);
});

Deno.test("kind 30397 rejects another kind", () => {
  expect(parses(makeMapNote({ kind: 30398 }))).toBe(false);
  expect(parses(makeEvent())).toBe(false);
});

Deno.test("kind 30397 rejects tags without a plus code", () => {
  expect(parses(makeMapNote({ tags: [] }))).toBe(false);
  expect(parses(makeMapNote({ tags: [["L", "open-location-code"]] }))).toBe(
    false,
  );
});

Deno.test("kind 30397 rejects an invalid plus code", () => {
  const tags = [
    ["L", "open-location-code"],
    ["l", "not-a-plus-code", "open-location-code"],
  ];
  expect(parses(makeMapNote({ tags }))).toBe(false);
});

Deno.test("kind 30397 enforces content length bounds", () => {
  expect(parses(makeMapNote({ content: "a".repeat(CONTENT_MINIMUM_LENGTH) })))
    .toBe(true);
  expect(
    parses(makeMapNote({ content: "a".repeat(CONTENT_MINIMUM_LENGTH - 1) })),
  ).toBe(false);
  expect(
    parses(makeMapNote({ content: "a".repeat(CONTENT_MAXIMUM_LENGTH) })),
  ).toBe(true);
  expect(
    parses(makeMapNote({ content: "a".repeat(CONTENT_MAXIMUM_LENGTH + 1) })),
  ).toBe(false);
});

Deno.test("kind 30397 rejects unfinalized events and unknown fields", () => {
  const { id: _id, ...withoutId } = makeMapNote();
  expect(parses(withoutId)).toBe(false);
  expect(parses(makeMapNote({ pubkey: "short" }))).toBe(false);
  expect(parses(makeMapNote({ extra: "field" }))).toBe(false);
});
