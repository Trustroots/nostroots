import {
  DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH,
  MAP_NOTE_KIND,
  MAP_NOTE_REPOST_KIND,
  OPEN_LOCATION_CODE_PREFIX_TAG_NAME,
  OPEN_LOCATION_CODE_TAG_NAME,
} from "../../nr-common/constants.ts";
import {
  getAllPlusCodePrefixes,
  getFirstLabelValueFromEvent,
  getFirstTagValueFromEvent,
  createLabelTags,
} from "../../nr-common/utils.ts";
import {
  DEFAULT_RELAYS,
  DELAY_AFTER_PROCESSING_EVENT_MS,
  DEV_PUBKEY,
  DEV_RELAYS,
  SUBSCRIPTIONS_MAX_AGE_IN_MINUTES,
} from "../common/constants.ts";
import { async, newQueue, nostrify } from "../deps.ts";
import { log } from "../log.ts";
import { validateEvent } from "./validate.ts";

const { NPool, NRelay1, NSecSigner } = nostrify;
type Tags = string[][];

async function getRelayPool(isDev: true | undefined) {
  const relays = isDev ? DEV_RELAYS : DEFAULT_RELAYS;

  // should be chosen according to outbox model
  // https://nostrify.dev/relay/outbox
  const pool = new NPool({
    open(url) {
      return new NRelay1(url);
    },
    async reqRouter(filter: nostrify.NostrFilter[]) {
      const map = new Map();
      relays.map((relay) => {
        map.set(relay, filter);
      });
      return map;
    },
    async eventRouter(_event) {
      return relays;
    },
  });

  return pool;
}

async function publishEvent(
  relayPool: nostrify.NPool,
  event: nostrify.NostrEvent
) {
  log.debug("#aSmTVL Publishing event");
  await relayPool.event(event);
  log.info("#p26tur Event published.", event);
}

/**
 * Take a nostr event that was signed by a user and generate the repost event.
 */
async function generateRepostedEvent(
  originalEvent: nostrify.NostrEvent,
  privateKey: Uint8Array
) {
  const derivedTags = deriveTags(originalEvent);
  const derivedContent = deriveContent(originalEvent);
  const originalEventDTagValue = getFirstTagValueFromEvent(originalEvent, "d");
  const dTag = [
    "d",
    `${originalEvent.pubkey}:${originalEvent.kind}:${originalEventDTagValue}`,
  ];
  const eTag = ["e", originalEvent.id];
  const pTag = ["p", originalEvent.pubkey];
  const originalCreatedAtTag = [
    "original_created_at",
    `${originalEvent.created_at}`,
  ];

  const signer = new NSecSigner(privateKey);
  const eventTemplate = {
    kind: MAP_NOTE_REPOST_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [eTag, pTag, dTag, originalCreatedAtTag, ...derivedTags],
    content: derivedContent,
  };
  const signedEvent = await signer.signEvent(eventTemplate);
  return signedEvent;
}

function deriveOpenLocationTags(event: nostrify.NostrEvent): Tags {
  const plusCode = getFirstLabelValueFromEvent(
    event,
    OPEN_LOCATION_CODE_TAG_NAME
  );
  if (typeof plusCode === "undefined") {
    return [];
  }
  const plusCodePrefixes = getAllPlusCodePrefixes(
    plusCode,
    DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH
  );
  const plusCodePrefixTags = createLabelTags(
    OPEN_LOCATION_CODE_PREFIX_TAG_NAME,
    plusCodePrefixes
  );
  return plusCodePrefixTags;
}

function deriveTags(event: nostrify.NostrEvent): Tags {
  const plusCodePrefixTags = deriveOpenLocationTags(event);
  const derivedTags = [...event.tags, ...plusCodePrefixTags];
  return derivedTags;
}

function deriveContent(event: nostrify.NostrEvent): string {
  return event.content;
}

/**
 * Create the filters to listen for events that we want to repost
 */
function createFilter(
  isDev: true | undefined,
  maxAgeMinutes: number | undefined
): nostrify.NostrFilter[] {
  const maxAgeSeconds =
    typeof maxAgeMinutes === "undefined" ? 60 * 60 : maxAgeMinutes * 60;

  const baseFilter: nostrify.NostrFilter = {
    kinds: [MAP_NOTE_KIND],
    since: Math.floor(Date.now() / 1e3) - maxAgeSeconds,
  };

  if (isDev) {
    return [{ ...baseFilter, authors: [DEV_PUBKEY] }];
  }

  return [baseFilter];
}

function processEventFactoryFactory(
  relayPool: nostrify.NPool,
  privateKey: Uint8Array
) {
  return function processEventFactory(event: nostrify.NostrEvent) {
    return async function () {
      log.debug(`#C1NJbQ Got event`, event);

      const isEventValid = await validateEvent(relayPool, event);
      if (!isEventValid) {
        log.info(`#u0Prc5 Discarding invalid event ${event.id}`);
        return;
      }
      const repostedEvent = await generateRepostedEvent(event, privateKey);
      publishEvent(relayPool, repostedEvent);

      await async.delay(DELAY_AFTER_PROCESSING_EVENT_MS);
    };
  };
}

export async function repost(
  privateKey: Uint8Array,
  isDev: true | undefined,
  maxAgeMinutes: number | undefined
) {
  log.debug(`#BmseJH Startup`);

  const relayPool = await getRelayPool(isDev);

  let lastReceivedMessageTimestamp = 0;
  let controller: AbortController;
  let signal: AbortSignal;

  async function _subscribe() {
    console.log(
      `(Re)starting subscriptions, last message received at ${lastReceivedMessageTimestamp} (${new Date(
        lastReceivedMessageTimestamp * 1000
      ).toLocaleString()})`
    );
    if (lastReceivedMessageTimestamp)
      maxAgeMinutes =
        (Math.floor(Date.now() / 1000) - lastReceivedMessageTimestamp) / 60 + 1;

    const filter = createFilter(isDev, maxAgeMinutes);

    if (controller) controller.abort();
    controller = new AbortController();
    signal = controller.signal;
    const subscription = relayPool.req(filter, { signal });

    const queue = newQueue(3);
    const processEventFactory = processEventFactoryFactory(
      relayPool,
      privateKey
    );

    try {
      for await (const msg of subscription) {
        console.log("got msg", msg);

        if (msg[0] === "EVENT") {
          const event = msg[2];
          lastReceivedMessageTimestamp = event.created_at;
          queue.add(processEventFactory(event));
        } else if (msg[0] === "EOSE") {
          if (isDev) {
            globalThis.setTimeout(() => {
              controller.abort();
            }, 10e3);
          }
        }
      }
    } catch (e) {
      console.log("got error");
      console.log(e.reason);
      console.log(e, typeof e);
    }
  }

  _subscribe();
  setInterval(_subscribe, SUBSCRIPTIONS_MAX_AGE_IN_MINUTES * 60 * 1000);
}
