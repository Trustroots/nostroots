import { expect } from "jsr:@std/expect@1.0.13";
import { SubscriptionStore } from "./subscriptionStore.ts";

Deno.test("SubscriptionStore flattens filters into pubkey pairs", () => {
  const store = new SubscriptionStore();
  store.updateFilters("alice", [{ kinds: [30398] }, { "#L": ["x"] }]);
  store.updateFilters("bob", [{ kinds: [1] }]);

  expect(store.getAllFilterPubkeyPairs()).toEqual([
    { filter: { kinds: [30398] }, pubkey: "alice" },
    { filter: { "#L": ["x"] }, pubkey: "alice" },
    { filter: { kinds: [1] }, pubkey: "bob" },
  ]);
  expect(store.pubkeyCount).toBe(2);
  expect(store.totalFilterCount).toBe(3);
});

Deno.test("SubscriptionStore replaces a pubkey's filters on update", () => {
  const store = new SubscriptionStore();
  store.updateFilters("alice", [{ kinds: [1] }, { kinds: [2] }]);
  store.updateFilters("alice", [{ kinds: [3] }]);

  expect(store.getAllFilterPubkeyPairs()).toEqual([
    { filter: { kinds: [3] }, pubkey: "alice" },
  ]);
  expect(store.totalFilterCount).toBe(1);
});

Deno.test("SubscriptionStore stores tokens and keeps them when an update has none", () => {
  const store = new SubscriptionStore();
  expect(store.getTokensForPubkey("alice")).toBeUndefined();

  store.updateTokens("alice", ["token-1"]);
  store.updateTokens("alice", ["token-2", "token-3"]);
  store.updateTokens("alice", []);

  expect(store.getTokensForPubkey("alice")).toEqual(["token-2", "token-3"]);
  expect(store.pubkeysWithTokensCount).toBe(1);
});
