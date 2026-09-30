import { expect } from "jsr:@std/expect@1.0.13";
import type { NostrEvent } from "nostr-tools";
import { matchAndNotify, type NotifyDeps } from "./matching.ts";
import { SeenEvents } from "./seenEvents.ts";
import { type PushToken, SubscriptionStore } from "./subscriptionStore.ts";

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

function fakeDeps() {
  const pushes: PushToken[][] = [];
  const deps: NotifyDeps = {
    seenEvents: new SeenEvents(),
    resolveUsername: () => Promise.resolve("author-name"),
    sendPushNotifications: (tokens) => {
      pushes.push([...tokens]);
      return Promise.resolve();
    },
  };
  return { deps, pushes };
}

Deno.test("matchAndNotify pushes once to a subscriber whose filters overlap", async () => {
  const store = new SubscriptionStore();
  store.updateFilters("alice", [{ kinds: [30397] }, { authors: ["author"] }]);
  store.updateTokens("alice", ["token-1"]);
  const { deps, pushes } = fakeDeps();

  await matchAndNotify(event, store, "secret", "ws://relay", deps);

  expect(pushes).toEqual([["token-1"]]);
});

Deno.test("matchAndNotify pushes once to a device registered under two pubkeys", async () => {
  const store = new SubscriptionStore();
  store.updateFilters("alice", [{ kinds: [30397] }]);
  store.updateFilters("alice-old", [{ kinds: [30397] }]);
  store.updateTokens("alice", ["token-1", "token-2"]);
  store.updateTokens("alice-old", ["token-1"]);
  const { deps, pushes } = fakeDeps();

  await matchAndNotify(event, store, "secret", "ws://relay", deps);

  expect(pushes.flat().sort()).toEqual(["token-1", "token-2"]);
});

Deno.test("matchAndNotify doesn't push the same event twice", async () => {
  const store = new SubscriptionStore();
  store.updateFilters("alice", [{ kinds: [30397] }]);
  store.updateTokens("alice", ["token-1"]);
  const { deps, pushes } = fakeDeps();

  await matchAndNotify(event, store, "secret", "ws://relay", deps);
  await matchAndNotify(event, store, "secret", "ws://relay", deps);

  expect(pushes).toEqual([["token-1"]]);
});

Deno.test("matchAndNotify retries an event whose username lookup failed", async () => {
  const store = new SubscriptionStore();
  store.updateFilters("alice", [{ kinds: [30397] }]);
  store.updateTokens("alice", ["token-1"]);
  const { deps, pushes } = fakeDeps();
  const failingDeps: NotifyDeps = {
    ...deps,
    resolveUsername: () => Promise.reject(new Error("relay down")),
  };

  await expect(
    matchAndNotify(event, store, "secret", "ws://relay", failingDeps),
  ).rejects.toThrow("relay down");
  await matchAndNotify(event, store, "secret", "ws://relay", deps);

  expect(pushes).toEqual([["token-1"]]);
});
