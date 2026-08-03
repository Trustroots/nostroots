import { expect } from "jsr:@std/expect";
import {
  getNip5PubKey,
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
  },
);

Deno.test("getNip5PubKey queries trustroots.org by default", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];

  globalThis.fetch = ((input: string | URL | Request) => {
    requestedUrls.push(String(input));
    return Promise.resolve(
      new Response(JSON.stringify({ names: { alice: "abc123" } }), {
        status: 200,
      }),
    );
  }) as typeof fetch;

  try {
    const result = await getNip5PubKey("alice");
    expect(result).toBe("abc123");
    expect(requestedUrls[0]).toBe(
      "https://trustroots.org/.well-known/nostr.json?name=alice",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test(
  "getNip5PubKey queries an overridden domain over http for localhost",
  async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];

    globalThis.fetch = ((input: string | URL | Request) => {
      requestedUrls.push(String(input));
      return Promise.resolve(
        new Response(JSON.stringify({ names: { alice: "abc123" } }), {
          status: 200,
        }),
      );
    }) as typeof fetch;

    try {
      await getNip5PubKey("alice", "localhost:8787");
      expect(requestedUrls[0]).toBe(
        "http://localhost:8787/.well-known/nostr.json?name=alice",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
