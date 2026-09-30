import { expect } from "jsr:@std/expect@1.0.13";
import { bytesToHex } from "@noble/hashes/utils";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip04,
} from "nostr-tools";
import { NOTIFICATION_SUBSCRIPTION_KIND } from "@trustroots/nr-common";
import {
  decryptAndParseSubscription,
  isEncryptedForDaemon,
} from "./decrypt.ts";

const daemonSecret = generateSecretKey();
const daemonKey = bytesToHex(daemonSecret);
const daemonPubkey = getPublicKey(daemonSecret);
const userSecret = generateSecretKey();

async function subscriptionEvent(
  payload: unknown,
  tags = [["p", daemonPubkey]],
) {
  const content = await nip04.encrypt(
    userSecret,
    daemonPubkey,
    JSON.stringify(payload),
  );
  return finalizeEvent(
    { kind: NOTIFICATION_SUBSCRIPTION_KIND, created_at: 1, tags, content },
    userSecret,
  );
}

const payload = {
  tokens: [{ expoPushToken: "ExponentPushToken[abc]" }],
  filters: [{ filter: { kinds: [30398], "#L": ["open-location-code"] } }],
};

Deno.test("isEncryptedForDaemon requires the daemon as first p tag and nip04 content", async () => {
  const event = await subscriptionEvent(payload);
  expect(isEncryptedForDaemon(event, daemonPubkey)).toBe(true);

  expect(isEncryptedForDaemon({ ...event, tags: [] }, daemonPubkey)).toBe(
    false,
  );
  expect(
    isEncryptedForDaemon(
      { ...event, tags: [["p", "other"], ["p", daemonPubkey]] },
      daemonPubkey,
    ),
  ).toBe(false);
  expect(
    isEncryptedForDaemon({ ...event, content: "plain" }, daemonPubkey),
  ).toBe(false);
});

Deno.test("decryptAndParseSubscription returns filters and tokens", async () => {
  const event = await subscriptionEvent(payload);

  expect(await decryptAndParseSubscription(event, daemonKey)).toEqual({
    filters: [{ kinds: [30398], "#L": ["open-location-code"] }],
    tokens: ["ExponentPushToken[abc]"],
  });
});

Deno.test("decryptAndParseSubscription returns undefined for invalid payloads", async () => {
  const invalid = await subscriptionEvent({ tokens: "nope", filters: [] });
  expect(await decryptAndParseSubscription(invalid, daemonKey)).toBeUndefined();

  const wrongKey = bytesToHex(generateSecretKey());
  const event = await subscriptionEvent(payload);
  expect(await decryptAndParseSubscription(event, wrongKey)).toBeUndefined();
});
