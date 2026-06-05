import {
  NOSTROOTS_METRICS_KIND,
  NOSTROOTS_METRICS_TYPE_PUSH_SUBSCRIPTIONS,
  NOSTROOTS_METRICS_TYPE_TAG_NAME,
  NOSTR_EXPIRATION_TAG_NAME,
  isPlusCode,
} from "@trustroots/nr-common";
import { finalizeEvent } from "nostr-tools/pure";
import { hexToBytes } from "@noble/hashes/utils";
import { Relay } from "nostr-tools/relay";
import { log } from "./log.ts";
import type { SubscriptionStore } from "./subscriptionStore.ts";

const METRICS_INTERVAL_MS = 10 * 60 * 1000;
const WORLD_D_TAG_VALUE = "world";
const METRICS_EXPIRATION_SECONDS = 30 * 24 * 60 * 60;

function buildPlusCodeSubscriptionMetrics(
  store: SubscriptionStore,
): Record<string, number> {
  const pubkeysByPlusCode = new Map<string, Set<string>>();

  for (const { filter, pubkey } of store.getAllFilterPubkeyPairs()) {
    const tokens = store.getTokensForPubkey(pubkey);
    if (!tokens || tokens.length === 0) {
      continue;
    }

    const plusCodes = filter["#l"];
    if (!Array.isArray(plusCodes)) {
      continue;
    }

    for (const plusCode of plusCodes) {
      if (!isPlusCode(plusCode)) {
        continue;
      }

      if (!pubkeysByPlusCode.has(plusCode)) {
        pubkeysByPlusCode.set(plusCode, new Set<string>());
      }

      pubkeysByPlusCode.get(plusCode)?.add(pubkey);
    }
  }

  const metrics: Record<string, number> = {};
  for (const [plusCode, pubkeys] of pubkeysByPlusCode.entries()) {
    metrics[plusCode] = pubkeys.size;
  }

  return metrics;
}

async function publishPushSubscriptionMetrics(
  relayUrl: string,
  privateKey: string,
  store: SubscriptionStore,
): Promise<void> {
  const metrics = buildPlusCodeSubscriptionMetrics(store);
  const content = JSON.stringify(metrics);
  const createdAt = Math.floor(Date.now() / 1000);
  const expiration = (createdAt + METRICS_EXPIRATION_SECONDS).toString();

  const event = finalizeEvent(
    {
      kind: NOSTROOTS_METRICS_KIND,
      created_at: createdAt,
      tags: [
        [
          NOSTROOTS_METRICS_TYPE_TAG_NAME,
          NOSTROOTS_METRICS_TYPE_PUSH_SUBSCRIPTIONS,
        ],
        ["d", WORLD_D_TAG_VALUE],
        [NOSTR_EXPIRATION_TAG_NAME, expiration],
      ],
      content,
    },
    hexToBytes(privateKey),
  );

  const relay = await Relay.connect(relayUrl);
  try {
    await relay.publish(event);
    log.info(
      `#n8xR4L Published push-subscriptions metrics for ${Object.keys(metrics).length} pluscodes (d=${WORLD_D_TAG_VALUE})`,
    );
  } finally {
    relay.close();
  }
}

export async function startPushSubscriptionMetricsPublisher(
  relayUrl: string,
  privateKey: string,
  store: SubscriptionStore,
): Promise<void> {
  await publishPushSubscriptionMetrics(relayUrl, privateKey, store);

  setInterval(() => {
    publishPushSubscriptionMetrics(relayUrl, privateKey, store).catch(
      (error) => {
        log.error(
          "#vF4mTw Failed to publish push-subscriptions metrics",
          error,
        );
      },
    );
  }, METRICS_INTERVAL_MS);
}
