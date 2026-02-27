import { generateSecretKey, getPublicKey, finalizeEvent, type Event } from "nostr-tools/pure";
import { Relay } from "nostr-tools/relay";
import {
  PING_ACK_KIND,
  NOSTROOTS_VALIDATION_PUBKEY,
} from "@trustroots/nr-common";
import { log } from "./log.ts";

export interface NrServerPingResult {
  status: "ok" | "error";
  durationMs?: number;
  error?: string;
}

function createPingEvent(secretKey: Uint8Array): Event {
  const eventTemplate = {
    kind: PING_ACK_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["p", NOSTROOTS_VALIDATION_PUBKEY]],
    content: "ping",
  };

  return finalizeEvent(eventTemplate, secretKey);
}

export async function runNrServerPing(
  relayWsUrl: string,
  timeoutSeconds: number = 60,
): Promise<NrServerPingResult> {
  const secretKey = generateSecretKey();
  const pingEvent = createPingEvent(secretKey);

  log.debug(`#Kj8Tv1 Publishing ping event with ID: ${pingEvent.id}`);

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

  return new Promise<NrServerPingResult>((resolve) => {
    const timeout = setTimeout(() => {
      log.error(
        `#Uv5Au6 Timeout after ${timeoutSeconds} seconds - no ACK received`,
      );
      relay.close();
      resolve({ status: "error", error: "Timeout waiting for ACK" });
    }, timeoutSeconds * 1000);

    const sub = relay.subscribe(
      [
        {
          kinds: [PING_ACK_KIND],
          authors: [NOSTROOTS_VALIDATION_PUBKEY],
          "#e": [pingEvent.id],
        },
      ],
      {
        onevent(event) {
          log.debug(
            `#Wx8Bv7 Received event kind ${event.kind} from ${event.pubkey.substring(0, 8)}...`,
          );

          if (
            event.kind === PING_ACK_KIND &&
            event.content === "ack" &&
            event.pubkey === NOSTROOTS_VALIDATION_PUBKEY
          ) {
            const durationMs = Date.now() - publishTime;
            log.info(
              `#Yz1Cw8 Received ACK! Event ID: ${event.id} (${durationMs}ms)`,
            );
            clearTimeout(timeout);
            sub.close();
            relay.close();
            resolve({ status: "ok", durationMs });
          }
        },
        oneose() {
          log.info(`#Ab4Dx9 End of stored events, publishing ping...`);
          relay.publish(pingEvent).then(
            () => log.info(`#Cd7Ey0 Ping published successfully`),
            (err) => {
              log.error(`#Ef0Fz1 Ping rejected: ${err}`);
              clearTimeout(timeout);
              sub.close();
              relay.close();
              resolve({
                status: "error",
                error: `Ping rejected: ${err}`,
              });
            },
          );
        },
      },
    );
  });
}
