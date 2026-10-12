import { assertEquals } from "@std/assert";
import type { Filter, NostrEvent } from "nostr-tools";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { matchAndNotify, type MatchDeps } from "./matching.ts";
import { Nip5VerificationError } from "./profiles.ts";
import { SubscriptionStore } from "./subscriptionStore.ts";

const authorPubkey = getPublicKey(generateSecretKey());

const event: NostrEvent = finalizeEvent(
  {
    kind: 30398,
    created_at: 1,
    tags: [
      ["p", authorPubkey],
      ["l", "9F4MGC00+", "open-location-code"],
    ],
    content: "hello",
  },
  generateSecretKey(),
);

interface PushCall {
  readonly tokens: readonly string[];
  readonly username?: string;
}

function fakeDeps(
  resolveUsername: MatchDeps["resolveUsername"] = () =>
    Promise.resolve("alice"),
): { deps: MatchDeps; pushes: PushCall[]; resolvedFor: string[] } {
  const pushes: PushCall[] = [];
  const resolvedFor: string[] = [];
  return {
    pushes,
    resolvedFor,
    deps: {
      resolveUsername: (pubkey, relayUrl) => {
        resolvedFor.push(pubkey);
        return resolveUsername(pubkey, relayUrl);
      },
      sendPushNotifications: (tokens, _event, _token, username) => {
        pushes.push({ tokens, username });
        return Promise.resolve();
      },
    },
  };
}

function storeWith(
  entries: Record<string, { filters: Filter[]; tokens: string[] }>,
): SubscriptionStore {
  const store = new SubscriptionStore();
  for (const [pubkey, { filters, tokens }] of Object.entries(entries)) {
    store.updateFilters(pubkey, filters);
    store.updateTokens(pubkey, tokens);
  }
  return store;
}

Deno.test("matchAndNotify pushes to every subscriber with a matching filter", async () => {
  const store = storeWith({
    sub1: {
      filters: [{ kinds: [30398], "#l": ["9F4MGC00+"] }],
      tokens: ["t1"],
    },
    sub2: { filters: [{ kinds: [30398] }], tokens: ["t2"] },
    sub3: { filters: [{ kinds: [1] }], tokens: ["t3"] },
  });
  const { deps, pushes } = fakeDeps();

  await matchAndNotify(event, store, "expo", "wss://relay", deps);

  assertEquals(pushes, [
    { tokens: ["t1"], username: "alice" },
    { tokens: ["t2"], username: "alice" },
  ]);
});

Deno.test("matchAndNotify resolves the username of the reposted author", async () => {
  const store = storeWith({
    sub1: { filters: [{ kinds: [30398] }], tokens: ["t1"] },
  });
  const { deps, resolvedFor } = fakeDeps();

  await matchAndNotify(event, store, "expo", "wss://relay", deps);

  assertEquals(resolvedFor, [authorPubkey]);
});

Deno.test("matchAndNotify does nothing when no filter matches", async () => {
  const store = storeWith({
    sub1: { filters: [{ kinds: [1] }], tokens: ["t1"] },
  });
  const { deps, pushes, resolvedFor } = fakeDeps();

  await matchAndNotify(event, store, "expo", "wss://relay", deps);

  assertEquals(pushes, []);
  assertEquals(resolvedFor, []);
});

Deno.test("matchAndNotify skips subscribers without tokens", async () => {
  const store = storeWith({
    sub1: { filters: [{ kinds: [30398] }], tokens: [] },
  });
  const { deps, pushes } = fakeDeps();

  await matchAndNotify(event, store, "expo", "wss://relay", deps);

  assertEquals(pushes, []);
});

Deno.test("matchAndNotify passes an unknown username through as undefined", async () => {
  const store = storeWith({
    sub1: { filters: [{ kinds: [30398] }], tokens: ["t1"] },
  });
  const { deps, pushes } = fakeDeps(() => Promise.resolve(undefined));

  await matchAndNotify(event, store, "expo", "wss://relay", deps);

  assertEquals(pushes, [{ tokens: ["t1"], username: undefined }]);
});

Deno.test("matchAndNotify drops the notification when NIP-05 verification fails", async () => {
  const store = storeWith({
    sub1: { filters: [{ kinds: [30398] }], tokens: ["t1"] },
  });
  const { deps, pushes } = fakeDeps(() =>
    Promise.reject(new Nip5VerificationError(authorPubkey, "alice", "someone"))
  );

  await matchAndNotify(event, store, "expo", "wss://relay", deps);

  assertEquals(pushes, []);
});
