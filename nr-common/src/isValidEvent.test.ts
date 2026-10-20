import { expect } from "jsr:@std/expect";
import { isValidEvent } from "./isValidEvent.ts";
import {
  makeEvent,
  makeMapNote,
  makeProfile,
  makeRepost,
  makeSubscription,
  plusCodeTags,
} from "./testEvents.ts";

const valid = (event: unknown) => isValidEvent(event as never);

Deno.test("isValidEvent accepts a generic finalized event", () => {
  expect(valid(makeEvent())).toBe(true);
});

Deno.test("isValidEvent accepts valid events of every specific kind", () => {
  expect(valid(makeProfile())).toBe(true);
  expect(valid(makeSubscription())).toBe(true);
  expect(valid(makeMapNote())).toBe(true);
  expect(valid(makeRepost())).toBe(true);
});

Deno.test("isValidEvent rejects a kind 30400 metrics event with an unsupported type", () => {
  const metrics = makeEvent({
    kind: 30400,
    tags: [["t", "not-a-supported-type"]],
  });
  expect(valid(metrics)).toBe(false);
});

Deno.test("isValidEvent rejects a map note without a plus code", () => {
  expect(valid(makeMapNote({ tags: [] }))).toBe(false);
});

Deno.test("isValidEvent rejects a map note with content outside the bounds", () => {
  expect(valid(makeMapNote({ content: "ab" }))).toBe(false);
  expect(valid(makeMapNote({ content: "a".repeat(4001) }))).toBe(false);
});

Deno.test("isValidEvent rejects a repost without a plus code", () => {
  expect(valid(makeRepost({ tags: [["p", "b".repeat(64)]] }))).toBe(false);
});

Deno.test("isValidEvent accepts a repost with a plus code", () => {
  expect(valid(makeRepost({ tags: plusCodeTags }))).toBe(true);
});

Deno.test("isValidEvent rejects a profile without a valid username", () => {
  expect(valid(makeProfile({ tags: [] }))).toBe(false);
  expect(
    valid(makeProfile({
      tags: [
        ["L", "org.trustroots:username"],
        ["l", "ab", "org.trustroots:username"],
      ],
    })),
  ).toBe(false);
});

Deno.test("isValidEvent rejects a subscription with non-string content", () => {
  expect(valid(makeSubscription({ content: null }))).toBe(false);
});

Deno.test("isValidEvent rejects malformed generic events", () => {
  expect(valid(makeEvent({ id: "short" }))).toBe(false);
  expect(valid(makeEvent({ pubkey: undefined }))).toBe(false);
  expect(valid(makeEvent({ extra: "field" }))).toBe(false);
  expect(valid(makeEvent({ tags: [[1]] }))).toBe(false);
});
