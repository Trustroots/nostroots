import { expect } from "../../deps.ts";
import { removeDTag } from "./repost.ts";

Deno.test("#WAhSqs Removes single d tag from tags array", () => {
  const tagsWithDTag = [
    ["d", "abc"],
    ["L", "foo"],
    ["l", "bar", "foo"],
  ];
  expect.expect(removeDTag(tagsWithDTag)).toEqual([
    ["L", "foo"],
    ["l", "bar", "foo"],
  ]);
});

Deno.test("#bUE1R1 Removes two d tags from tags array", () => {
  const tagsWithDTag = [
    ["d", "abc"],
    ["L", "foo"],
    ["l", "bar", "foo"],
    ["d", "def"],
  ];
  expect.expect(removeDTag(tagsWithDTag)).toEqual([
    ["L", "foo"],
    ["l", "bar", "foo"],
  ]);
});

Deno.test("#uwaNer Removes single d tags without value from tags array", () => {
  const tagsWithDTag = [["d"], ["L", "foo"], ["l", "bar", "foo"]];
  expect.expect(removeDTag(tagsWithDTag)).toEqual([
    ["L", "foo"],
    ["l", "bar", "foo"],
  ]);
});
