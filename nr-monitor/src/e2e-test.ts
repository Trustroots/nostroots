import { getPublicKey, finalizeEvent, type Event } from "nostr-tools/pure";
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

interface NostrMessage {
  type: string;
  subscriptionId?: string;
  event?: Event;
  ok?: boolean;
  message?: string;
}

function parseNostrMessage(data: string): NostrMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return null;

    const [type, ...rest] = parsed;

    if (type === "EVENT") {
      return { type: "EVENT", subscriptionId: rest[0], event: rest[1] };
    }
    if (type === "OK") {
      return { type: "OK", ok: rest[1], message: rest[2] };
    }
    if (type === "EOSE") {
      return { type: "EOSE", subscriptionId: rest[0] };
    }
    if (type === "NOTICE") {
      return { type: "NOTICE", message: rest[0] };
    }

    return { type };
  } catch {
    return null;
  }
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
  timeoutSeconds: number = 60
): Promise<E2EResult> {
  const secretKey = hexToBytes(privateKeyHex);
  const publicKey = getPublicKey(secretKey);

  // Validate the private key matches expected E2E test key
  if (publicKey !== E2E_TEST_AUTHOR_PUBLIC_KEY) {
    return {
      status: "error",
      error: `Private key does not match expected E2E_TEST_AUTHOR_PUBLIC_KEY`,
    };
  }

  const dTag = generateTestDTag();
  const testEvent = createTestEvent(secretKey, dTag);

  // The repost d tag format is: {original_pubkey}:{original_kind}:{original_d_tag}
  const expectedRepostDTag = `${testEvent.pubkey}:${MAP_NOTE_KIND}:${dTag}`;

  console.log(`[E2E] Publishing test event with d tag: ${dTag}`);
  console.log(`[E2E] Expected repost d tag: ${expectedRepostDTag}`);
  console.log(`[E2E] Event ID: ${testEvent.id}`);

  return new Promise((resolve) => {
    let resolved = false;
    let ws: WebSocket | null = null;
    let publishTime: number | null = null;

    const cleanup = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };

    const timeout = setTimeout(() => {
      if (!resolved) {
        console.log(
          `[E2E] Timeout after ${timeoutSeconds} seconds - no repost received`
        );
        resolved = true;
        cleanup();
        resolve({ status: "error", error: "Timeout waiting for repost" });
      }
    }, timeoutSeconds * 1000);

    try {
      ws = new WebSocket(relayWsUrl);

      ws.onopen = () => {
        console.log(`[E2E] Connected to ${relayWsUrl}`);

        // Subscribe for the expected repost
        const subscriptionId = "e2e-repost-sub";
        const filter = {
          kinds: [MAP_NOTE_REPOST_KIND],
          authors: [NOSTROOTS_VALIDATION_PUBKEY],
          "#d": [expectedRepostDTag],
          since: Math.floor(Date.now() / 1000) - 60,
        };

        const subMsg = JSON.stringify(["REQ", subscriptionId, filter]);
        console.log(`[E2E] Subscribing for repost...`);
        ws!.send(subMsg);

        // Publish the test event after a small delay to ensure subscription is active
        setTimeout(() => {
          const pubMsg = JSON.stringify(["EVENT", testEvent]);
          console.log(`[E2E] Publishing test event...`);
          publishTime = Date.now();
          ws!.send(pubMsg);
        }, 500);
      };

      ws.onmessage = (messageEvent) => {
        const msg = parseNostrMessage(messageEvent.data as string);
        if (!msg) return;

        if (msg.type === "OK") {
          if (msg.ok) {
            console.log(`[E2E] Event published successfully`);
          } else {
            console.log(`[E2E] Event rejected: ${msg.message}`);
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              cleanup();
              resolve({ status: "error", error: `Event rejected: ${msg.message}` });
            }
          }
        }

        if (msg.type === "NOTICE") {
          console.log(`[E2E] Relay notice: ${msg.message}`);
        }

        if (msg.type === "EVENT" && msg.event) {
          const event = msg.event;
          console.log(
            `[E2E] Received event kind ${event.kind} from ${event.pubkey.substring(0, 8)}...`
          );

          // Check if this is the repost we're waiting for
          if (
            event.kind === MAP_NOTE_REPOST_KIND &&
            event.pubkey === NOSTROOTS_VALIDATION_PUBKEY
          ) {
            const eventDTag = event.tags.find((t) => t[0] === "d")?.[1];
            if (eventDTag === expectedRepostDTag) {
              const durationMs = publishTime
                ? Date.now() - publishTime
                : Date.now();
              console.log(
                `[E2E] Received matching repost! Event ID: ${event.id}`
              );
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                cleanup();
                resolve({ status: "ok", durationMs });
              }
            }
          }
        }
      };

      ws.onerror = (error) => {
        console.error(`[E2E] WebSocket error:`, error);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          resolve({ status: "error", error: "WebSocket error" });
        }
      };

      ws.onclose = () => {
        console.log(`[E2E] WebSocket closed`);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ status: "error", error: "WebSocket closed unexpectedly" });
        }
      };
    } catch (error) {
      console.error(`[E2E] Failed to connect:`, error);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });
}
