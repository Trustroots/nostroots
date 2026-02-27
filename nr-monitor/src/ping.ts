import { generateSecretKey, finalizeEvent, type Event } from "nostr-tools/pure";
import { Relay } from "nostr-tools/relay";
import { PING_ACK_KIND } from "@trustroots/nr-common";
import { log } from "./log.ts";

export interface PingResult {
  status: "ok" | "error";
  durationMs?: number;
  error?: string;
}

function createPingEvent(
  secretKey: Uint8Array,
  targetPubkey: string,
): Event {
  return finalizeEvent(
    {
      kind: PING_ACK_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["p", targetPubkey]],
      content: "ping",
    },
    secretKey,
  );
}

export async function runPing(
  relayWsUrl: string,
  targetPubkey: string,
  timeoutSeconds: number = 60,
): Promise<PingResult> {
  const secretKey = generateSecretKey();
  const pingEvent = createPingEvent(secretKey, targetPubkey);

  log.debug(
    `#Kj8Tv1 Pinging ${targetPubkey.substring(0, 8)}... event ID: ${pingEvent.id}`,
  );

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

  const publishTime = Date.now();

  return new Promise<PingResult>((resolve) => {
    const timeout = setTimeout(() => {
      log.error(
        `#Uv5Au6 Timeout after ${timeoutSeconds}s pinging ${targetPubkey.substring(0, 8)}...`,
      );
      relay.close();
      resolve({ status: "error", error: "Timeout waiting for ACK" });
    }, timeoutSeconds * 1000);

    const sub = relay.subscribe(
      [
        {
          kinds: [PING_ACK_KIND],
          authors: [targetPubkey],
          "#e": [pingEvent.id],
        },
      ],
      {
        onevent(event) {
          if (
            event.kind === PING_ACK_KIND &&
            event.content === "ack" &&
            event.pubkey === targetPubkey
          ) {
            const durationMs = Date.now() - publishTime;
            log.info(
              `#Yz1Cw8 ACK from ${targetPubkey.substring(0, 8)}... (${durationMs}ms)`,
            );
            clearTimeout(timeout);
            sub.close();
            relay.close();
            resolve({ status: "ok", durationMs });
          }
        },
        oneose() {
          log.debug(`#Ab4Dx9 End of stored events, publishing ping...`);
          relay.publish(pingEvent).then(
            () => log.debug(`#Cd7Ey0 Ping published`),
            (err) => {
              log.error(`#Ef0Fz1 Ping rejected: ${err}`);
              clearTimeout(timeout);
              sub.close();
              relay.close();
              resolve({ status: "error", error: `Ping rejected: ${err}` });
            },
          );
        },
      },
    );
  });
}
