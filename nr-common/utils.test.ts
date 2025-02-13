import { expect } from "jsr:@std/expect";
import {
  isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue,
  isValidTagsArrayWithTrustrootsUsername,
} from "./utils.ts";

Deno.test("#QX3iok Tags with namespace and no value returns false", () => {
  const tags = [
    ["L", "open-location-code"],
    ["L", "foo"],
    ["l", "bar", "foo"],
  ];
  expect(isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue(tags)).toBe(false);
});

Deno.test("#QkbuAn Tags with namespace and value returns true", () => {
  const tags = [
    ["L", "open-location-code"],
    ["l", "CC000000+", "open-location-code"],
    ["L", "foo"],
    ["l", "bar", "foo"],
  ];
  expect(isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue(tags)).toBe(true);
});

Deno.test("#qdp7pp Tags with two char username returns false", () => {
  const tags = [
    ["L", "open-location-code"],
    ["l", "CC000000+", "open-location-code"],
    ["L", "org.trustroots:username"],
    ["l", "ab", "org.trustroots:username"],
  ];
  expect(isValidTagsArrayWithTrustrootsUsername(tags)).toBe(false);
});

Deno.test("#6kqkIj Tags with four char username returns true", () => {
  const tags = [
    ["L", "open-location-code"],
    ["l", "CC000000+", "open-location-code"],
    ["L", "org.trustroots:username"],
    ["l", "abcd", "org.trustroots:username"],
  ];
  expect(isValidTagsArrayWithTrustrootsUsername(tags)).toBe(true);
});

Deno.test(
  "#v91hjr Tags with username namespace and no value returns false",
  () => {
    const tags = [
      ["L", "foo"],
      ["l", "bar", "foo"],
      ["L", "org.trustroots:username"],
    ];
    expect(isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue(tags)).toBe(false);
  }
);
