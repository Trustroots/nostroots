import { expect } from "jsr:@std/expect@1.0.13";
import { EVENT_DELETION_KIND, MAP_NOTE_KIND } from "@trustroots/nr-common";
import type { NostrEvent } from "nostr-tools/core";
import {
  MAX_DELETION_CONTENT_LENGTH,
  MAX_DELETION_TARGETS,
  validateDeletion,
} from "./validateDeletion.ts";

const AUTHOR = "a".repeat(64);
const OTHER_AUTHOR = "b".repeat(64);

function makeDeletion(tags: string[][], content = ""): NostrEvent {
  return {
    id: "c".repeat(64),
    pubkey: AUTHOR,
    sig: "e".repeat(128),
    kind: EVENT_DELETION_KIND,
    created_at: 1_700_000_000,
    tags,
    content,
  };
}

Deno.test("validateDeletion accepts a deletion of one event by id", () => {
  expect(validateDeletion(makeDeletion([["e", "d".repeat(64)]])))
    .toBeUndefined();
});

Deno.test("validateDeletion accepts the author deleting their own addressable note", () => {
  const deletion = makeDeletion([
    ["a", `${MAP_NOTE_KIND}:${AUTHOR}:some-d-tag`],
    ["k", `${MAP_NOTE_KIND}`],
  ]);

  expect(validateDeletion(deletion)).toBeUndefined();
});

Deno.test("validateDeletion ignores events that aren't deletions", () => {
  const note = { ...makeDeletion([]), kind: MAP_NOTE_KIND };

  expect(validateDeletion(note)).toBeUndefined();
});

Deno.test("validateDeletion rejects a deletion with no targets", () => {
  expect(validateDeletion(makeDeletion([["p", OTHER_AUTHOR]]))).toMatch(
    /^blocked: /,
  );
});

Deno.test("validateDeletion rejects a deletion with too many targets", () => {
  const tags = Array.from(
    { length: MAX_DELETION_TARGETS + 1 },
    (_, i) => ["e", i.toString(16).padStart(64, "0")],
  );

  expect(validateDeletion(makeDeletion(tags))).toMatch(/^blocked: /);
  expect(validateDeletion(makeDeletion(tags.slice(1)))).toBeUndefined();
});

Deno.test("validateDeletion rejects an oversized reason", () => {
  const deletion = makeDeletion(
    [["e", "d".repeat(64)]],
    "x".repeat(MAX_DELETION_CONTENT_LENGTH + 1),
  );

  expect(validateDeletion(deletion)).toMatch(/^blocked: /);
});

Deno.test("validateDeletion rejects deleting another author's addressable event", () => {
  const deletion = makeDeletion([
    ["a", `${MAP_NOTE_KIND}:${OTHER_AUTHOR}:some-d-tag`],
  ]);

  expect(validateDeletion(deletion)).toMatch(/^blocked: /);
});

Deno.test("validateDeletion rejects coordinates or k tags for kinds we don't store", () => {
  expect(
    validateDeletion(makeDeletion([["a", `1:${AUTHOR}:x`]])),
  ).toMatch(/^blocked: /);
  expect(
    validateDeletion(makeDeletion([["e", "d".repeat(64)], ["k", "1"]])),
  ).toMatch(/^blocked: /);
  expect(
    validateDeletion(makeDeletion([["a", "not-a-coordinate"]])),
  ).toMatch(/^blocked: /);
});
