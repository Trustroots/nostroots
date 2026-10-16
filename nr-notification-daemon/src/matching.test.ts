import { assertEquals } from "@std/assert";
import type { Filter, NostrEvent } from "nostr-tools";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import {
  TRUSTROOTS_PROFILE_KIND,
  TRUSTROOTS_USERNAME_LABEL_NAMESPACE,
} from "@trustroots/nr-common";
import { matchAndNotify } from "./matching.ts";
import { SubscriptionStore } from "./subscriptionStore.ts";

interface PushRequest {
  readonly tokens: readonly string[];
  readonly title: string;
}

interface Harness {
  readonly relayUrl: string;
  readonly pushes: PushRequest[];
  readonly profileRequests: string[];
  readonly event: NostrEvent;
  readonly authorPubkey: string;
}

/**
 * Runs `matchAndNotify` against a real WebSocket relay on localhost, with
 * `fetch` stubbed at the network edge for the NIP-05 lookup and the Expo push
 * API. A fresh author key per test keeps the module-level username cache out
 * of the way.
 */
async function withHarness(
  options: { username?: string; nip05Pubkey?: string },
  run: (harness: Harness) => Promise<void>,
): Promise<void> {
  const authorSecret = generateSecretKey();
  const authorPubkey = getPublicKey(authorSecret);
  const profileRequests: string[] = [];
  const pushes: PushRequest[] = [];

  const profile = options.username
    ? finalizeEvent(
      {
        kind: TRUSTROOTS_PROFILE_KIND,
        created_at: 1,
        tags: [
          ["L", TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
          ["l", options.username, TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
        ],
        content: "",
      },
      authorSecret,
    )
    : undefined;

  const relay = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: () => {} },
    (request) => {
      const { socket, response } = Deno.upgradeWebSocket(request);
      socket.onmessage = (message) => {
        const [type, subId, filter] = JSON.parse(message.data);
        if (type !== "REQ") return;
        profileRequests.push(...(filter.authors ?? []));
        if (profile) socket.send(JSON.stringify(["EVENT", subId, profile]));
        socket.send(JSON.stringify(["EOSE", subId]));
      };
      return response;
    },
  );

  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://trustroots.org/.well-known/nostr.json")) {
      const name = new URL(url).searchParams.get("name") ?? "";
      return Promise.resolve(
        Response.json({
          names: { [name]: options.nip05Pubkey ?? authorPubkey },
        }),
      );
    }
    if (url.startsWith("https://exp.host/")) {
      const messages = JSON.parse(String(init?.body)) as {
        to: string;
        title: string;
      }[];
      pushes.push({
        tokens: messages.map((message) => message.to),
        title: messages[0].title,
      });
      return Promise.resolve(
        Response.json({ data: messages.map(() => ({ status: "ok" })) }),
      );
    }
    return realFetch(input, init);
  };

  try {
    await run({
      relayUrl: `ws://127.0.0.1:${relay.addr.port}`,
      pushes,
      profileRequests,
      authorPubkey,
      event: finalizeEvent(
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
      ),
    });
  } finally {
    globalThis.fetch = realFetch;
    await relay.shutdown();
  }
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

function test(name: string, fn: () => Promise<void>) {
  // The profile lookup leaves a 5s timeout behind, which the sanitizers flag.
  Deno.test({ name, fn, sanitizeOps: false, sanitizeResources: false });
}

test("matchAndNotify pushes to every subscriber with a matching filter", () =>
  withHarness({ username: "alice" }, async (h) => {
    const store = storeWith({
      sub1: {
        filters: [{ kinds: [30398], "#l": ["9F4MGC00+"] }],
        tokens: ["t1"],
      },
      sub2: { filters: [{ kinds: [30398] }], tokens: ["t2"] },
      sub3: { filters: [{ kinds: [1] }], tokens: ["t3"] },
    });

    await matchAndNotify(h.event, store, "expo", h.relayUrl);

    assertEquals(h.pushes, [
      { tokens: ["t1"], title: "alice posted on the map" },
      { tokens: ["t2"], title: "alice posted on the map" },
    ]);
  }));

test("matchAndNotify resolves the username of the reposted author", () =>
  withHarness({ username: "alice" }, async (h) => {
    const store = storeWith({
      sub1: { filters: [{ kinds: [30398] }], tokens: ["t1"] },
    });

    await matchAndNotify(h.event, store, "expo", h.relayUrl);

    assertEquals(h.profileRequests, [h.authorPubkey]);
  }));

test("matchAndNotify does nothing when no filter matches", () =>
  withHarness({ username: "alice" }, async (h) => {
    const store = storeWith({
      sub1: { filters: [{ kinds: [1] }], tokens: ["t1"] },
    });

    await matchAndNotify(h.event, store, "expo", h.relayUrl);

    assertEquals(h.pushes, []);
    assertEquals(h.profileRequests, []);
  }));

test("matchAndNotify skips subscribers without tokens", () =>
  withHarness({ username: "alice" }, async (h) => {
    const store = storeWith({
      sub1: { filters: [{ kinds: [30398] }], tokens: [] },
    });

    await matchAndNotify(h.event, store, "expo", h.relayUrl);

    assertEquals(h.pushes, []);
  }));

test("matchAndNotify falls back to a generic title for an unknown username", () =>
  withHarness({}, async (h) => {
    const store = storeWith({
      sub1: { filters: [{ kinds: [30398] }], tokens: ["t1"] },
    });

    await matchAndNotify(h.event, store, "expo", h.relayUrl);

    assertEquals(h.pushes, [
      { tokens: ["t1"], title: "Somebody posted on the map" },
    ]);
  }));

test("matchAndNotify drops the notification when NIP-05 verification fails", () =>
  withHarness({ username: "alice", nip05Pubkey: "someone-else" }, async (h) => {
    const store = storeWith({
      sub1: { filters: [{ kinds: [30398] }], tokens: ["t1"] },
    });

    await matchAndNotify(h.event, store, "expo", h.relayUrl);

    assertEquals(h.pushes, []);
  }));

test("matchAndNotify pushes once per subscriber when several of their filters match", () =>
  withHarness({ username: "alice" }, async (h) => {
    const store = storeWith({
      sub1: {
        filters: [{ kinds: [30398] }, { "#l": ["9F4MGC00+"] }],
        tokens: ["t1"],
      },
    });

    await matchAndNotify(h.event, store, "expo", h.relayUrl);

    assertEquals(h.pushes, [
      { tokens: ["t1"], title: "alice posted on the map" },
    ]);
  }));

test("matchAndNotify pushes once per token when subscribers share a device", () =>
  withHarness({ username: "alice" }, async (h) => {
    const store = storeWith({
      sub1: { filters: [{ kinds: [30398] }], tokens: ["shared", "t1"] },
      sub2: { filters: [{ kinds: [30398] }], tokens: ["shared"] },
    });

    await matchAndNotify(h.event, store, "expo", h.relayUrl);

    assertEquals(h.pushes, [
      { tokens: ["shared", "t1"], title: "alice posted on the map" },
    ]);
  }));
