import { expect } from "jsr:@std/expect";
import { CONTENT_MAXIMUM_LENGTH } from "../constants.ts";
import { kind30397EventSchema } from "./30397.schema.ts";
import { kind30398EventSchema } from "./30398.schema.ts";

const locationTags = [
  ["L", "open-location-code"],
  ["l", "8FVC2222+22", "open-location-code"],
];

function makeEvent(kind: 30397 | 30398, content: string, gathering: boolean) {
  return {
    id: "a".repeat(64),
    pubkey: "b".repeat(64),
    created_at: 1_780_000_000,
    kind,
    tags: gathering ? [...locationTags, ["start", "1780003600"]] : locationTags,
    content,
    sig: "signature",
  };
}

for (const [kind, schema] of [
  [30397, kind30397EventSchema],
  [30398, kind30398EventSchema],
] as const) {
  Deno.test(
    `kind ${kind} accepts empty and short gathering descriptions`,
    () => {
      for (const content of ["", "a", "ab"]) {
        expect(schema.safeParse(makeEvent(kind, content, true)).success).toBe(
          true,
        );
      }
    },
  );

  Deno.test(`kind ${kind} keeps the normal note minimum`, () => {
    expect(schema.safeParse(makeEvent(kind, "ab", false)).success).toBe(false);
    expect(schema.safeParse(makeEvent(kind, "abc", false)).success).toBe(true);
  });

  Deno.test(
    `kind ${kind} rejects gathering descriptions above the maximum`,
    () => {
      expect(
        schema.safeParse(
          makeEvent(kind, "a".repeat(CONTENT_MAXIMUM_LENGTH + 1), true),
        ).success,
      ).toBe(false);
    },
  );
}
