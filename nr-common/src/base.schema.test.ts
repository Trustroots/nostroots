import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CONTENT_MAXIMUM_LENGTH, CONTENT_MINIMUM_LENGTH } from "../constants.ts";
import { contentSchema } from "./base.schema.ts";

Deno.test("contentSchema accepts content well beyond the old 300 char limit", () => {
  assertEquals(contentSchema.safeParse("a".repeat(1000)).success, true);
});

Deno.test("contentSchema accepts content at the maximum length", () => {
  assertEquals(
    contentSchema.safeParse("a".repeat(CONTENT_MAXIMUM_LENGTH)).success,
    true,
  );
});

Deno.test("contentSchema still rejects content above the maximum length", () => {
  assertEquals(
    contentSchema.safeParse("a".repeat(CONTENT_MAXIMUM_LENGTH + 1)).success,
    false,
  );
});

Deno.test("contentSchema still rejects content below the minimum length", () => {
  assertEquals(
    contentSchema.safeParse("a".repeat(CONTENT_MINIMUM_LENGTH - 1)).success,
    false,
  );
});
