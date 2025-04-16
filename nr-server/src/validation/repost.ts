import { async, nostrify, nrCommon } from "../../deps.ts";
import { DELAY_AFTER_PROCESSING_EVENT_MS } from "../common/constants.ts";
import { log } from "../log.ts";

const {
  DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH,
  MAP_NOTE_REPOST_KIND,
  OPEN_LOCATION_CODE_PREFIX_TAG_NAME,
  OPEN_LOCATION_CODE_TAG_NAME,
  createLabelTags,
  getAllPlusCodePrefixes,
  getFirstLabelValueFromEvent,
  getFirstTagValueFromEvent,
} = nrCommon;

import { validateEvent } from "./validate.ts";

const { NSecSigner } = nostrify;
type Tags = string[][];

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

export function removeDTag(tags: Tags): Tags {
  const filteredTags = tags.filter(([tag]) => tag !== "d");
  return filteredTags;
}

function deriveTags(event: nostrify.NostrEvent): Tags {
  const plusCodePrefixTags = deriveOpenLocationTags(event);
  const tagsExcludingDTag = removeDTag(event.tags);
  const derivedTags = [...tagsExcludingDTag, ...plusCodePrefixTags];
  return derivedTags;
}

function deriveContent(event: nostrify.NostrEvent): string {
  return event.content;
}

export function processEventFactoryFactory(
  relayPool: nostrify.NPool,
  privateKey: Uint8Array
) {
  return async function processEventFactory(
    event: nostrify.NostrEvent,
    requestId?: string
  ) {
    const logId =
      typeof requestId === "string" && requestId.length > 0
        ? ` ${requestId}`
        : "";
    log.debug(`#C1NJbQ${logId} Got event`, event);

    if (event.kind === MAP_NOTE_REPOST_KIND) {
      log.info(
        `#WAKKJk${logId} Skipping kind ${MAP_NOTE_REPOST_KIND} event with ID ${event.id}`
      );
    }

    const isEventValid = await validateEvent(relayPool, event);
    if (!isEventValid) {
      log.info(`#u0Prc5${logId} Discarding invalid event ${event.id}`);
      return;
    }
    const repostedEvent = await generateRepostedEvent(event, privateKey);
    publishEvent(relayPool, repostedEvent);

    await async.delay(DELAY_AFTER_PROCESSING_EVENT_MS);
  };
}
