import { SIGNAL_TAG_NAME } from "@/constants/signals";
import { EventWithMetadata } from "@/redux/slices/events.slice";
import {
  getFirstTagValueFromEvent,
  NOSTR_EXPIRATION_TAG_NAME,
} from "@trustroots/nr-common";
import { NostrEvent } from "nostr-tools";

export function isEventExpired(event: NostrEvent): boolean {
  const expirationString = getFirstTagValueFromEvent(
    event,
    NOSTR_EXPIRATION_TAG_NAME,
  );
  if (typeof expirationString === "undefined") return false;
  const expiration = parseInt(expirationString);
  if (isNaN(expiration)) return false;
  const now = Math.floor(Date.now() / 1000);
  return expiration <= now;
}

export function getUnexpiredEvents(
  events: EventWithMetadata[],
): EventWithMetadata[] {
  return events.filter((e) => !isEventExpired(e.event));
}

function hasSignalTag(event: NostrEvent): boolean {
  return event.tags.some((tag) => tag[0] === "t" && tag[1] === SIGNAL_TAG_NAME);
}

export function getActiveSignals(
  events: EventWithMetadata[],
): EventWithMetadata[] {
  const signals = events.filter(
    (e) => hasSignalTag(e.event) && !isEventExpired(e.event),
  );

  const latestByPubkey = new Map<string, EventWithMetadata>();
  for (const signal of signals) {
    const pubkey = signal.event.pubkey;
    const existing = latestByPubkey.get(pubkey);
    if (!existing || signal.event.created_at > existing.event.created_at) {
      latestByPubkey.set(pubkey, signal);
    }
  }

  return Array.from(latestByPubkey.values()).sort(
    (a, b) => b.event.created_at - a.event.created_at,
  );
}
