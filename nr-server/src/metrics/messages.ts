import { nostrify, nostrTools, nrCommon } from "../../deps.ts";
import { log } from "../log.ts";

const {
  MAP_NOTE_REPOST_KIND,
  NOSTROOTS_METRICS_KIND,
  NOSTROOTS_METRICS_TYPE_TAG_NAME,
  NOSTR_EXPIRATION_TAG_NAME,
  OPEN_LOCATION_CODE_TAG_NAME,
  getFirstLabelValueFromEvent,
} = nrCommon;

const METRICS_INTERVAL_MS = 10 * 60 * 1000;
const METRICS_FETCH_LIMIT = 1000;
const WORLD_D_TAG_VALUE = "world";
const METRICS_EXPIRATION_SECONDS = 30 * 24 * 60 * 60;

type MessageCounts = Record<string, number>;

async function fetchMessageCounts(
  relayPool: nostrify.NPool,
  authorPubkey: string,
): Promise<MessageCounts> {
  const counts: MessageCounts = {};
  let until: number | undefined = Math.floor(Date.now() / 1000);
  const SUBSCRIPTION_TIMEOUT_MS = 30 * 1000; // 30 second timeout per page

  while (true) {
    const filter: nostrify.NostrFilter = {
      kinds: [MAP_NOTE_REPOST_KIND],
      authors: [authorPubkey],
      limit: METRICS_FETCH_LIMIT,
      until,
    };

    const subscription = relayPool.req([filter]);
    const pageEvents: nostrify.NostrEvent[] = [];

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                `#Kx8vQw Metrics subscription timeout after ${SUBSCRIPTION_TIMEOUT_MS}ms`,
              ),
            ),
          SUBSCRIPTION_TIMEOUT_MS,
        );
      });

      await Promise.race([
        (async () => {
          for await (const msg of subscription) {
            if (msg[0] !== "EVENT") {
              continue;
            }

            pageEvents.push(msg[2]);
          }
        })(),
        timeoutPromise,
      ]);
    } catch (error) {
      if (error instanceof Error && error.message.includes("timeout")) {
        log.warn(`#Kx8vQx Metrics fetch timed out, using partial results`);
        // Continue with partial results
      } else {
        throw error;
      }
    }

    if (pageEvents.length === 0) {
      break;
    }

    for (const event of pageEvents) {
      const plusCode = getFirstLabelValueFromEvent(
        event,
        OPEN_LOCATION_CODE_TAG_NAME,
      );

      if (!plusCode) {
        continue;
      }

      counts[plusCode] = (counts[plusCode] ?? 0) + 1;
    }

    if (pageEvents.length < METRICS_FETCH_LIMIT) {
      break;
    }

    const oldestCreatedAt = Math.min(
      ...pageEvents.map((event) => event.created_at),
    );
    if (!Number.isFinite(oldestCreatedAt) || oldestCreatedAt <= 0) {
      break;
    }

    const nextUntil = oldestCreatedAt - 1;
    if (typeof until === "number" && nextUntil >= until) {
      break;
    }
    until = nextUntil;
  }

  return counts;
}

async function publishMessagesMetrics(
  relayPool: nostrify.NPool,
  privateKey: Uint8Array,
  authorPubkey: string,
) {
  const counts = await fetchMessageCounts(relayPool, authorPubkey);

  const signer = new nostrify.NSecSigner(privateKey);
  const createdAt = Math.floor(Date.now() / 1000);
  const expiration = (createdAt + METRICS_EXPIRATION_SECONDS).toString();

  const eventTemplate = {
    kind: NOSTROOTS_METRICS_KIND,
    created_at: createdAt,
    tags: [
      [NOSTROOTS_METRICS_TYPE_TAG_NAME, "messages"],
      ["d", WORLD_D_TAG_VALUE],
      [NOSTR_EXPIRATION_TAG_NAME, expiration],
    ],
    content: JSON.stringify(counts),
  };

  const signedEvent = await signer.signEvent(eventTemplate);
  await relayPool.event(signedEvent);
  log.info(
    `#Nw3JHg Published messages metrics for ${Object.keys(counts).length} plus codes (d=${WORLD_D_TAG_VALUE})`,
  );
}

export async function startMessagesMetricsPublisher(
  relayPool: nostrify.NPool,
  privateKey: Uint8Array,
) {
  const authorPubkey = nostrTools.getPublicKey(privateKey);
  let isPublishing = false;

  const publishSafe = async () => {
    if (isPublishing) {
      log.warn(
        "#g6rYcN Skipping messages metrics publish because previous run is still in progress",
      );
      return;
    }

    isPublishing = true;
    try {
      await publishMessagesMetrics(relayPool, privateKey, authorPubkey);
    } catch (error) {
      log.error("#n6ZL4R Failed to publish messages metrics", error);
    } finally {
      isPublishing = false;
    }
  };

  await publishSafe();

  setInterval(() => {
    publishSafe();
  }, METRICS_INTERVAL_MS);
}
