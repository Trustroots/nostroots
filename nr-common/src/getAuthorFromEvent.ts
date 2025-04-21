import type { NostrEvent } from "npm:nostr-tools@2.10.4/core";
import { MAP_NOTE_REPOST_KIND } from "../constants.ts";
import { eventSchema } from "./event.schema.ts";
import { getFirstTagValueFromEvent } from "./utils.ts";

export function getAuthorFromEvent(event: NostrEvent) {
  const result = eventSchema.safeParse(event);
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
