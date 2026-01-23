import { Event, EventTemplate, finalizeEvent } from "nostr-tools";
import { hexToBytes } from "@noble/hashes/utils";
import { nanoid } from "nanoid";
import {
  MAP_NOTE_KIND,
  OPEN_LOCATION_CODE_LABEL_NAMESPACE,
  OPEN_LOCATION_CODE_PREFIX_LABEL_NAMESPACE,
  LABEL_NAMESPACE_TAG,
  PLUS_CODE_TAG_KEY,
} from "@trustroots/nr-common";
import { getPlusCodePrefixes } from "./utils";

/**
 * Create a map note event
 */
export function createMapNote(
  content: string,
  plusCode: string,
  privateKeyHex: string
): Event {
  // Generate a unique d-tag
  const dTag = nanoid();

  // Get plus code prefixes for the prefix tag
  const prefixes = getPlusCodePrefixes(plusCode);

  // Build the event template
  const eventTemplate: EventTemplate = {
    kind: MAP_NOTE_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      // d-tag for parameterized replaceable event
      ["d", dTag],
      // Label namespace for open-location-code
      [LABEL_NAMESPACE_TAG, OPEN_LOCATION_CODE_LABEL_NAMESPACE],
      // The actual plus code
      [PLUS_CODE_TAG_KEY, plusCode, OPEN_LOCATION_CODE_LABEL_NAMESPACE],
      // Label namespace for prefixes
      [LABEL_NAMESPACE_TAG, OPEN_LOCATION_CODE_PREFIX_LABEL_NAMESPACE],
      // Plus code prefixes for querying by area
      [PLUS_CODE_TAG_KEY, ...prefixes, OPEN_LOCATION_CODE_PREFIX_LABEL_NAMESPACE],
    ],
    content,
  };

  // Sign and finalize the event
  const privateKeyBytes = hexToBytes(privateKeyHex);
  const signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);

  return signedEvent;
}

/**
 * Create a trustroots profile event
 */
export function createProfileEvent(
  username: string,
  privateKeyHex: string
): Event {
  const eventTemplate: EventTemplate = {
    kind: 10390, // TRUSTROOTS_PROFILE_KIND
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["L", "org.trustroots:username"],
      ["l", username, "org.trustroots:username"],
    ],
    content: "",
  };

  const privateKeyBytes = hexToBytes(privateKeyHex);
  const signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);

  return signedEvent;
}

/**
 * Create a reply event to another event
 * Uses NIP-10 markers for threading
 */
export function createReplyEvent(
  content: string,
  parentEvent: Event,
  privateKeyHex: string
): Event {
  // Get the root event ID (if this is a reply to a reply)
  const rootTag = parentEvent.tags.find((t) => t[0] === "e" && t[3] === "root");
  const rootId = rootTag ? rootTag[1] : parentEvent.id;

  const tags: string[][] = [
    // Root reference
    ["e", rootId, "", "root"],
    // Reply reference (the event we're directly replying to)
    ["e", parentEvent.id, "", "reply"],
    // Reference the author we're replying to
    ["p", parentEvent.pubkey],
  ];

  // If there's a location on the parent event, include it in the reply
  const locationTag = parentEvent.tags.find(
    (t) => t[0] === "l" && t[2] === "open-location-code"
  );
  if (locationTag) {
    tags.push([LABEL_NAMESPACE_TAG, OPEN_LOCATION_CODE_LABEL_NAMESPACE]);
    tags.push([...locationTag]);
  }

  const eventTemplate: EventTemplate = {
    kind: 1, // Regular text note for replies
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
  };

  const privateKeyBytes = hexToBytes(privateKeyHex);
  const signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);

  return signedEvent;
}
