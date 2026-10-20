import { assertEquals } from "@std/assert";
import { SubscriptionStore } from "./subscriptionStore.ts";

Deno.test("SubscriptionStore returns one pair per filter per pubkey", () => {
  const store = new SubscriptionStore();
  store.updateFilters("alice", [{ kinds: [1] }, { kinds: [2] }]);
  store.updateFilters("bob", [{ kinds: [3] }]);

  assertEquals(store.getAllFilterPubkeyPairs(), [
    { filter: { kinds: [1] }, pubkey: "alice" },
    { filter: { kinds: [2] }, pubkey: "alice" },
    { filter: { kinds: [3] }, pubkey: "bob" },
  ]);
  assertEquals(store.pubkeyCount, 2);
  assertEquals(store.totalFilterCount, 3);
});

Deno.test("SubscriptionStore replaces filters and tokens on update", () => {
  const store = new SubscriptionStore();
  store.updateFilters("alice", [{ kinds: [1] }]);
  store.updateTokens("alice", ["token-a"]);
  store.updateFilters("alice", [{ kinds: [2] }]);
  store.updateTokens("alice", ["token-b"]);

  assertEquals(store.getAllFilterPubkeyPairs(), [
    { filter: { kinds: [2] }, pubkey: "alice" },
  ]);
  assertEquals(store.getTokensForPubkey("alice"), ["token-b"]);
  assertEquals(store.pubkeysWithTokensCount, 1);
});

Deno.test("SubscriptionStore returns undefined tokens for unknown pubkey", () => {
  const store = new SubscriptionStore();
  assertEquals(store.getTokensForPubkey("nobody"), undefined);
});

Deno.test("SubscriptionStore clears tokens when updated with an empty list", () => {
  const store = new SubscriptionStore();
  store.updateFilters("alice", [{ kinds: [1] }]);
  store.updateTokens("alice", ["token-a"]);
  store.updateTokens("alice", []);

  assertEquals(store.getTokensForPubkey("alice"), undefined);
  assertEquals(store.pubkeysWithTokensCount, 0);
});
