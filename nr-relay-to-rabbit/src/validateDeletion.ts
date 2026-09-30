import { ACCEPTED_KINDS, EVENT_DELETION_KIND } from "@trustroots/nr-common";
import type { NostrEvent } from "nostr-tools/core";

// A guess at "generous": check against real spam samples (#199).
export const MAX_DELETION_TARGETS = 50;
export const MAX_DELETION_CONTENT_LENGTH = 1000;

function isAcceptedKind(kind: string): boolean {
  return ACCEPTED_KINDS.some((accepted) => `${accepted}` === kind);
}

/**
 * Checks a kind 5 deletion against what this relay can store. Returns a
 * strfry rejection message, or undefined when the event may be accepted.
 * Other kinds always pass.
 */
export function validateDeletion(event: NostrEvent): string | undefined {
  if (event.kind !== EVENT_DELETION_KIND) {
    return undefined;
  }

  const targets = event.tags.filter(([name]) => name === "e" || name === "a");

  if (targets.length === 0) {
    return "blocked: deletion targets nothing";
  }
  if (targets.length > MAX_DELETION_TARGETS) {
    return `blocked: deletion targets more than ${MAX_DELETION_TARGETS} events`;
  }
  if (event.content.length > MAX_DELETION_CONTENT_LENGTH) {
    return "blocked: deletion reason is too long";
  }

  const hasForeignCoordinate = targets.some(([name, value = ""]) => {
    if (name !== "a") return false;
    const [kind, pubkey] = value.split(":");
    return pubkey !== event.pubkey || !isAcceptedKind(kind);
  });
  const hasForeignKind = event.tags.some(
    ([name, value = ""]) => name === "k" && !isAcceptedKind(value),
  );

  if (hasForeignCoordinate || hasForeignKind) {
    return "blocked: deletion targets nothing we store";
  }

  return undefined;
}
