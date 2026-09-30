import { expect } from "jsr:@std/expect@1.0.13";
import type { NostrEvent } from "nostr-tools";
import { matchAndNotify } from "./matching.ts";
import { SubscriptionStore } from "./subscriptionStore.ts";

const event: NostrEvent = {
  id: "event-id",
  pubkey: "author",
  created_at: 1,
  kind: 30397,
  tags: [],
  content: "hello",
  sig: "sig",
};

Deno.test("matchAndNotify skips the lookup and push once a subscriber unregistered", async () => {
  const store = new SubscriptionStore();
  store.updateFilters("alice", [{ kinds: [30397] }]);
  store.updateTokens("alice", ["token-1"]);
  store.updateTokens("alice", []);

  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = () => {
    fetches++;
    return Promise.reject(new Error("unexpected fetch"));
  };
  try {
    // An unreachable relay: resolving the author's username would throw.
    await matchAndNotify(event, store, "secret", "ws://127.0.0.1:1");
  } finally {
    globalThis.fetch = originalFetch;
  }
  expect(fetches).toBe(0);
});
