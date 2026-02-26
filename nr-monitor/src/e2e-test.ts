import { getPublicKey, finalizeEvent, type Event } from "nostr-tools/pure";
import { Relay } from "nostr-tools/relay";
import { hexToBytes } from "@noble/hashes/utils";
import {
  MAP_NOTE_KIND,
  MAP_NOTE_REPOST_KIND,
  NOSTROOTS_VALIDATION_PUBKEY,
  E2E_TEST_AUTHOR_PUBLIC_KEY,
} from "@trustroots/nr-common";

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
  const timestamp = new Date().toISOString();

  const eventTemplate = {
    kind: MAP_NOTE_KIND,
    created_at,
    tags: [
      ["d", dTag],
      ["t", "e2e-healthcheck"],
      ["L", "open-location-code"],
      ["l", "5Q000000+", "open-location-code"], // Middle of Pacific Ocean
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

  console.log(`[E2E] Publishing test event with d tag: ${dTag}`);
  console.log(`[E2E] Expected repost d tag: ${expectedRepostDTag}`);
  console.log(`[E2E] Event ID: ${testEvent.id}`);

  let relay: Relay;
  try {
    relay = await Relay.connect(relayWsUrl);
  } catch (error) {
    console.error(`[E2E] Failed to connect:`, error);
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  console.log(`[E2E] Connected to ${relayWsUrl}`);
  const publishTime = Date.now();

  return new Promise<E2EResult>((resolve) => {
    const timeout = setTimeout(() => {
      console.log(
        `[E2E] Timeout after ${timeoutSeconds} seconds - no repost received`,
      );
      relay.close();
      resolve({ status: "error", error: "Timeout waiting for repost" });
    }, timeoutSeconds * 1000);

    const sub = relay.subscribe(
      [
        {
          kinds: [MAP_NOTE_REPOST_KIND],
          authors: [NOSTROOTS_VALIDATION_PUBKEY],
          "#d": [expectedRepostDTag],
          since: Math.floor(Date.now() / 1000) - 60,
        },
      ],
      {
        onevent(event) {
          console.log(
            `[E2E] Received event kind ${event.kind} from ${event.pubkey.substring(0, 8)}...`,
          );

          if (
            event.kind === MAP_NOTE_REPOST_KIND &&
            event.pubkey === NOSTROOTS_VALIDATION_PUBKEY
          ) {
            const eventDTag = event.tags.find((t) => t[0] === "d")?.[1];
            if (eventDTag === expectedRepostDTag) {
              const durationMs = Date.now() - publishTime;
              console.log(
                `[E2E] Received matching repost! Event ID: ${event.id}`,
              );
              clearTimeout(timeout);
              sub.close();
              relay.close();
              resolve({ status: "ok", durationMs });
            }
          }
        },
        oneose() {
          console.log(`[E2E] End of stored events, publishing test event...`);
          relay.publish(testEvent).then(
            () => console.log(`[E2E] Event published successfully`),
            (err) => {
              console.log(`[E2E] Event rejected: ${err}`);
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
