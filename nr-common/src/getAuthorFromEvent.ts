import type { NostrEvent } from "nostr-tools/core";
import { MAP_NOTE_REPOST_KIND } from "../constants.ts";
import {
  eventSchema,
  kindSpecificEventSchema,
  kindsWithSpecificSchema,
} from "./event.schema.ts";
import { getFirstTagValueFromEvent } from "./utils.ts";

export function getAuthorFromEvent(event: NostrEvent) {
  const schema = kindsWithSpecificSchema.has(event?.kind)
    ? kindSpecificEventSchema
    : eventSchema;
  const result = schema.safeParse(event);
  if (!result.success) {
    return;
  }
  const parsedEvent = result.data;

  switch (parsedEvent.kind) {
    case MAP_NOTE_REPOST_KIND: {
      const originalAuthorPublicKey = getFirstTagValueFromEvent(event, "p");
      return originalAuthorPublicKey;
    }

    default:
      // TODO - Handle delegated signing and so on here
      return event.pubkey;
  }
}
