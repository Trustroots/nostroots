import { expect } from "jsr:@std/expect@1.0.13";
import {
  ACCEPTED_KINDS,
  MAP_NOTE_KIND,
  OPEN_LOCATION_CODE_TAG_NAME,
} from "@trustroots/nr-common";
import { parseJsonLine, type StrfryLine } from "./parseLines.ts";
import { acceptEvent, rejectEvent } from "./strfryResponses.ts";
import { whitelistKinds } from "./whitelistKinds.ts";

const EVENT_ID = "c".repeat(64);

function makeLine(kind: number, tags: string[][] = []) {
  return {
    type: "new",
    event: {
      id: EVENT_ID,
      pubkey: "a".repeat(64),
      sig: "e".repeat(128),
      kind,
      created_at: 1_700_000_000,
      tags,
      content: "hello there",
    },
    receivedAt: 1_700_000_001,
    sourceType: "IP4",
    sourceInfo: "127.0.0.1",
  };
}

Deno.test("parseJsonLine parses a strfry plugin line", () => {
  const line = makeLine(MAP_NOTE_KIND, [
    ["L", OPEN_LOCATION_CODE_TAG_NAME],
    ["l", "8FVC9G8F+6W", OPEN_LOCATION_CODE_TAG_NAME],
  ]);

  expect(parseJsonLine(JSON.stringify(line))).toEqual(line);
});

Deno.test("parseJsonLine returns undefined for invalid JSON or shapes", () => {
  expect(parseJsonLine("{not json")).toBeUndefined();
  expect(
    parseJsonLine(JSON.stringify({ ...makeLine(1), type: "lookback" })),
  ).toBeUndefined();
  expect(
    parseJsonLine(JSON.stringify({ ...makeLine(1), receivedAt: 1.5 })),
  ).toBeUndefined();
});

Deno.test("acceptEvent and rejectEvent answer with the event id", () => {
  const line = makeLine(1) as StrfryLine;

  expect(JSON.parse(acceptEvent(line))).toEqual({
    id: EVENT_ID,
    action: "accept",
  });
  expect(JSON.parse(rejectEvent(line, "blocked: kind"))).toEqual({
    id: EVENT_ID,
    action: "reject",
    msg: "blocked: kind",
  });
});

Deno.test("whitelistKinds accepts only the configured kinds", () => {
  for (const kind of ACCEPTED_KINDS) {
    expect(whitelistKinds(makeLine(kind) as StrfryLine)).toBe(true);
  }
  expect(whitelistKinds(makeLine(1) as StrfryLine)).toBe(false);
});
