import { expect } from "jsr:@std/expect";
import { whitelistKinds } from "./whitelistKinds.ts";
import type { StrfryLine } from "./parseLines.ts";

function lineWithKind(kind: number): StrfryLine {
  return {
    type: "new",
    event: {
      id: "0".repeat(64),
      pubkey: "1".repeat(64),
      created_at: 1762300800,
      kind,
      tags: [],
      content: "",
      sig: "2".repeat(128),
    },
    receivedAt: 1762300800,
    sourceType: "IP4",
    sourceInfo: "127.0.0.1",
  };
}

Deno.test("#Lf7kQa accepts a map note (30397)", () => {
  expect(whitelistKinds(lineWithKind(30397))).toBe(true);
});

Deno.test("#Lf2pBx accepts a Lightfoot box (37840)", () => {
  expect(whitelistKinds(lineWithKind(37840))).toBe(true);
});

Deno.test("#Lf6sRp accepts a Lightfoot status report (37841)", () => {
  expect(whitelistKinds(lineWithKind(37841))).toBe(true);
});

Deno.test("#Lf3oLd rejects the old Lightfoot draft kind (30404)", () => {
  expect(whitelistKinds(lineWithKind(30404))).toBe(false);
});

Deno.test("#Lf9cMn accepts a NIP-22 comment (1111)", () => {
  expect(whitelistKinds(lineWithKind(1111))).toBe(true);
});

Deno.test("#Lf4rTz rejects a kind 1 text note", () => {
  expect(whitelistKinds(lineWithKind(1))).toBe(false);
});
