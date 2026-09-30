import { expect } from "jsr:@std/expect@1.0.13";
import { SeenEvents } from "./seenEvents.ts";

Deno.test("markIfNew is true only the first time an event is seen", () => {
  const seen = new SeenEvents();

  expect(seen.markIfNew("a")).toBe(true);
  expect(seen.markIfNew("a")).toBe(false);
  expect(seen.markIfNew("b")).toBe(true);
});

Deno.test("an event can be notified again once its entry expires", () => {
  let now = 0;
  const seen = new SeenEvents({ ttlMs: 1000, now: () => now });

  seen.markIfNew("a");
  now = 999;
  expect(seen.markIfNew("a")).toBe(false);
  now = 1000;
  expect(seen.markIfNew("a")).toBe(true);
});

Deno.test("the oldest entries are dropped beyond the size bound", () => {
  const seen = new SeenEvents({ maxSize: 2 });

  seen.markIfNew("a");
  seen.markIfNew("b");
  seen.markIfNew("c");

  expect(seen.size).toBe(2);
  expect(seen.markIfNew("b")).toBe(false);
  expect(seen.markIfNew("a")).toBe(true);
});
