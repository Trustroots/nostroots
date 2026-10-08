import { expect } from "jsr:@std/expect";
import * as constants from "./constants.ts";

Deno.test("#kN4sYc Every exported *_KIND constant is in ACCEPTED_KINDS", () => {
  const kinds = Object.entries(constants)
    .filter(([name]) => name.endsWith("_KIND"))
    .map(([, value]) => value as number);

  expect(kinds.length).toBeGreaterThan(0);
  for (const kind of kinds) {
    expect(constants.ACCEPTED_KINDS).toContain(kind);
  }
});

Deno.test("#pV8wTe ACCEPTED_KINDS has no duplicates or unnamed kinds", () => {
  const kinds = Object.entries(constants)
    .filter(([name]) => name.endsWith("_KIND"))
    .map(([, value]) => value as number);

  expect(new Set(constants.ACCEPTED_KINDS).size).toBe(
    constants.ACCEPTED_KINDS.length,
  );
  expect([...constants.ACCEPTED_KINDS].sort()).toEqual([...kinds].sort());
});
