import { assertEquals, assertRejects } from "@std/assert";
import { createAPNSPayload } from "../src/apns.ts";
import { matchAndNotify } from "../src/matching.ts";
import { vibeSubscriptionPayloadSchema } from "../src/schema.ts";
import { SubscriptionStore } from "../src/subscriptionStore.ts";

Deno.test("parses Vibe APNs subscription payload", () => {
  const parsed = vibeSubscriptionPayloadSchema.parse({
    version: 1,
    client: "vibe-browser",
    tokens: [{
      platform: "ios",
      provider: "apns",
      token: "abc123",
      topic: "org.trustroots.nostroots.browser",
      environment: "sandbox",
    }],
    filters: [{
      filter: {
        kinds: [30398],
        authors: ["f".repeat(64)],
        "#L": ["open-location-code"],
        "#l": ["849VCWC8+2X"],
      },
    }],
  });

  assertEquals(parsed.tokens[0].provider, "apns");
  assertEquals(parsed.filters[0].filter["#l"], ["849VCWC8+2X"]);
});

Deno.test("rejects Expo-style tokens in Vibe payload", async () => {
  await assertRejects(
    async () => {
      await vibeSubscriptionPayloadSchema.parseAsync({
        version: 1,
        client: "vibe-browser",
        tokens: [{ expoPushToken: "ExponentPushToken[abc]" }],
        filters: [],
      });
    },
  );
});

Deno.test("subscription store clears tokens when empty token list is published", () => {
  const store = new SubscriptionStore();
  const token = {
    platform: "ios" as const,
    provider: "apns" as const,
    token: "abc123",
    topic: "org.trustroots.nostroots.browser",
    environment: "sandbox" as const,
  };
  store.update("pubkey", [], [token]);
  assertEquals(store.getTokensForPubkey("pubkey").length, 1);

  store.update("pubkey", [], []);
  assertEquals(store.getTokensForPubkey("pubkey"), []);
});

Deno.test("APNs payload includes eventJSON and plusCode", () => {
  const event = {
    id: "a".repeat(64),
    pubkey: "b".repeat(64),
    created_at: 1,
    kind: 30398,
    tags: [["l", "849VCWC8+2X", "open-location-code"]],
    content: "hello",
    sig: "c".repeat(128),
  };

  const payload = createAPNSPayload(event);

  assertEquals(payload.type, "eventJSON");
  assertEquals(payload.plusCode, "849VCWC8+2X");
  assertEquals(JSON.parse(String(payload.event)).id, event.id);
});

Deno.test("matching subscriptions send APNs for stored token", async () => {
  const store = new SubscriptionStore();
  const token = {
    platform: "ios" as const,
    provider: "apns" as const,
    token: "abc123",
    topic: "org.trustroots.nostroots.browser",
    environment: "sandbox" as const,
  };
  store.update("pubkey", [{
    kinds: [30398],
    "#L": ["open-location-code"],
    "#l": ["849VCWC8+2X"],
  }], [token]);

  const event = {
    id: "a".repeat(64),
    pubkey: "b".repeat(64),
    created_at: 1,
    kind: 30398,
    tags: [["L", "open-location-code"], ["l", "849VCWC8+2X", "open-location-code"]],
    content: "hello",
    sig: "c".repeat(128),
  };
  const sent: string[] = [];

  await matchAndNotify(event, store, {
    teamId: "team",
    keyId: "key",
    privateKey: "private",
    topic: "org.trustroots.nostroots.browser",
    environment: "sandbox",
  }, async (apnsToken) => {
    sent.push(apnsToken.token);
  });

  assertEquals(sent, ["abc123"]);
});
