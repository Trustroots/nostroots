import { getPublicKey, finalizeEvent, type Event } from "nostr-tools/pure";
import { Relay } from "nostr-tools/relay";
import { hexToBytes } from "@noble/hashes/utils";
import {
  MAP_NOTE_KIND,
  MAP_NOTE_REPOST_KIND,
  NOSTROOTS_VALIDATION_PUBKEY,
  E2E_TEST_AUTHOR_PUBLIC_KEY,
  NOSTR_EXPIRATION_TAG_NAME,
} from "@trustroots/nr-common";
import { log } from "./log.ts";

export interface E2EResult {
  status: "ok" | "error";
  durationMs?: number;
  error?: string;
}

function generateTestDTag(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `e2e-${timestamp}-${random}`;
}

function createTestEvent(secretKey: Uint8Array, dTag: string): Event {
  const created_at = Math.floor(Date.now() / 1000);
  const expiration = created_at + 300; // Expire after 5 minutes
  const timestamp = new Date().toISOString();

  const eventTemplate = {
    kind: MAP_NOTE_KIND,
    created_at,
    tags: [
      ["d", dTag],
      ["t", "e2e-healthcheck"],
      ["L", "open-location-code"],
      ["l", "5Q000000+", "open-location-code"], // Middle of Pacific Ocean
      [NOSTR_EXPIRATION_TAG_NAME, expiration.toString()],
    ],
    content: `Automated healthcheck for Nostroots validation pipeline. Test run at ${timestamp}. Please ignore this message.`,
  };

  return finalizeEvent(eventTemplate, secretKey);
}

export async function runE2ETest(
  relayWsUrl: string,
  privateKeyHex: string,
  timeoutSeconds: number = 60,
): Promise<E2EResult> {
  const secretKey = hexToBytes(privateKeyHex);
  const publicKey = getPublicKey(secretKey);

  if (publicKey !== E2E_TEST_AUTHOR_PUBLIC_KEY) {
    return {
      status: "error",
      error: `Private key does not match expected E2E_TEST_AUTHOR_PUBLIC_KEY`,
    };
  }

  const dTag = generateTestDTag();
  const testEvent = createTestEvent(secretKey, dTag);
  const expectedRepostDTag = `${testEvent.pubkey}:${MAP_NOTE_KIND}:${dTag}`;

  log.debug(`#Kj8Tv1 Publishing test event with d tag: ${dTag}`);
  log.debug(`#Lm3Wq2 Expected repost d tag: ${expectedRepostDTag}`);
  log.debug(`#Np6Xr3 Event ID: ${testEvent.id}`);

  let relay: Relay;
  try {
    relay = await Relay.connect(relayWsUrl);
  } catch (error) {
    log.error(`#Qr9Ys4 Failed to connect:`, error);
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  log.info(`#St2Zt5 Connected to ${relayWsUrl}`);
  const publishTime = Date.now();

  return new Promise<E2EResult>((resolve) => {
    const timeout = setTimeout(() => {
      log.error(`#Uv5Au6 Timeout after ${timeoutSeconds} seconds - no repost received`);
      relay.close();
      resolve({ status: "error", error: "Timeout waiting for repost" });
    }, timeoutSeconds * 1000);

    const sub = relay.subscribe(
      [
        {
          kinds: [MAP_NOTE_REPOST_KIND],
          authors: [NOSTROOTS_VALIDATION_PUBKEY],
          "#d": [expectedRepostDTag],
        },
      ],
      {
        onevent(event) {
          log.debug(`#Wx8Bv7 Received event kind ${event.kind} from ${event.pubkey.substring(0, 8)}...`);

          if (
            event.kind === MAP_NOTE_REPOST_KIND &&
            event.pubkey === NOSTROOTS_VALIDATION_PUBKEY
          ) {
            const eventDTag = event.tags.find((t) => t[0] === "d")?.[1];
            if (eventDTag === expectedRepostDTag) {
              const durationMs = Date.now() - publishTime;
              log.info(`#Yz1Cw8 Received matching repost! Event ID: ${event.id}`);
              clearTimeout(timeout);
              sub.close();
              relay.close();
              resolve({ status: "ok", durationMs });
            }
          }
        },
        oneose() {
          log.info(`#Ab4Dx9 End of stored events, publishing test event...`);
          relay.publish(testEvent).then(
            () => log.info(`#Cd7Ey0 Event published successfully`),
            (err) => {
              log.error(`#Ef0Fz1 Event rejected: ${err}`);
              clearTimeout(timeout);
              sub.close();
              relay.close();
              resolve({ status: "error", error: `Event rejected: ${err}` });
            },
          );
        },
      },
    );
  });
}
