import { assertEquals } from "@std/assert";
import { nip04 } from "nostr-tools";
import { bytesToHex } from "@noble/hashes/utils";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import type { NostrEvent } from "nostr-tools";
import {
  decryptAndParseSubscription,
  isEncryptedForDaemon,
} from "./decrypt.ts";

const daemonKey = generateSecretKey();
const daemonPubkey = getPublicKey(daemonKey);
const userKey = generateSecretKey();

const filter = { kinds: [30398], "#l": ["9F4MGC00+"] };

async function subscriptionEvent(
  content: unknown,
  tags: string[][] = [["p", daemonPubkey]],
): Promise<NostrEvent> {
  const encrypted = await nip04.encrypt(
    bytesToHex(userKey),
    daemonPubkey,
    JSON.stringify(content),
  );
  return finalizeEvent(
    { kind: 10395, created_at: 1, tags, content: encrypted },
    userKey,
  );
}

Deno.test("isEncryptedForDaemon accepts an event whose first p tag is the daemon", async () => {
  const event = await subscriptionEvent({});
  assertEquals(isEncryptedForDaemon(event, daemonPubkey), true);
});

Deno.test("isEncryptedForDaemon rejects events without a p tag", async () => {
  const event = await subscriptionEvent({}, []);
  assertEquals(isEncryptedForDaemon(event, daemonPubkey), false);
});

Deno.test("isEncryptedForDaemon rejects events addressed to another server first", async () => {
  const event = await subscriptionEvent({}, [
    ["p", "other"],
    ["p", daemonPubkey],
  ]);
  assertEquals(isEncryptedForDaemon(event, daemonPubkey), false);
});

Deno.test("isEncryptedForDaemon rejects content without a NIP-04 iv marker", async () => {
  const event = { ...(await subscriptionEvent({})), content: "plain" };
  assertEquals(isEncryptedForDaemon(event, daemonPubkey), false);
});

Deno.test("decryptAndParseSubscription returns filters and expo tokens", async () => {
  const event = await subscriptionEvent({
    tokens: [{ expoPushToken: "ExponentPushToken[abc]" }],
    filters: [{ filter }],
  });

  assertEquals(
    await decryptAndParseSubscription(event, bytesToHex(daemonKey)),
    { filters: [filter], tokens: ["ExponentPushToken[abc]"] },
  );
});

Deno.test("decryptAndParseSubscription returns undefined for invalid content", async () => {
  const event = await subscriptionEvent({ nope: true });
  assertEquals(
    await decryptAndParseSubscription(event, bytesToHex(daemonKey)),
    undefined,
  );
});

Deno.test("decryptAndParseSubscription returns undefined when encrypted to another key", async () => {
  const event = await subscriptionEvent({
    tokens: [{ expoPushToken: "ExponentPushToken[abc]" }],
    filters: [{ filter }],
  });
  assertEquals(
    await decryptAndParseSubscription(event, bytesToHex(generateSecretKey())),
    undefined,
  );
});
