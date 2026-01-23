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
