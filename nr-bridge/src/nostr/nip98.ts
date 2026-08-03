/**
 * @module nip98
 *
 * Verification of NIP-98 HTTP Auth events, used to attribute incoming requests
 * to a Nostr pubkey.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/98.md
 */
import { verifyEvent } from "nostr-tools/pure";
import type { Event } from "nostr-tools/pure";
import {
  unpackEventFromToken,
  validateEventKind,
  validateEventMethodTag,
  validateEventPayloadTag,
  validateEventTimestamp,
} from "nostr-tools/nip98";

/** Successful verification: the request is attributed to `pubkey`. */
export interface Nip98Success {
  ok: true;
  /** Hex-encoded public key of the signer. */
  pubkey: string;
}

/** Failed verification, with a reason safe to return to the client. */
export interface Nip98Failure {
  ok: false;
  reason: string;
}

export type Nip98Result = Nip98Success | Nip98Failure;

/**
 * Verify the `Authorization` header of an incoming request.
 *
 * The `u` tag is checked by pathname rather than by full URL equality: the
 * bridge runs behind a proxy, so the scheme and host it sees need not match
 * the ones the client signed. The signature, the 60-second timestamp window,
 * and the payload hash still bind the token to this exact request body.
 *
 * @param authorization - Raw `Authorization` header value, or null.
 * @param expectedPath  - Pathname the token must be scoped to, e.g. `/support`.
 * @param method        - HTTP method of the request.
 * @param body          - Parsed JSON request body, hashed into the payload tag.
 * @returns The signer's pubkey, or a failure reason.
 */
export async function verifyNip98Header(
  authorization: string | null | undefined,
  expectedPath: string,
  method: string,
  body: Record<string, unknown>,
): Promise<Nip98Result> {
  if (!authorization) {
    return { ok: false, reason: "Missing Authorization header" };
  }

  let event: Event;
  try {
    event = await unpackEventFromToken(authorization);
  } catch {
    return { ok: false, reason: "Malformed Authorization header" };
  }

  if (!verifyEvent(event)) {
    return { ok: false, reason: "Invalid signature" };
  }
  if (!validateEventKind(event)) {
    return { ok: false, reason: "Invalid event kind" };
  }
  if (!validateEventTimestamp(event)) {
    return { ok: false, reason: "Expired or future-dated auth event" };
  }
  if (!validateEventMethodTag(event, method)) {
    return { ok: false, reason: "Method tag does not match request" };
  }
  if (!hasMatchingPath(event, expectedPath)) {
    return { ok: false, reason: "URL tag does not match request" };
  }
  if (!validateEventPayloadTag(event, body)) {
    return { ok: false, reason: "Payload tag does not match request body" };
  }

  return { ok: true, pubkey: event.pubkey };
}

function hasMatchingPath(event: Event, expectedPath: string): boolean {
  const urlTag = event.tags.find((tag) => tag[0] === "u");
  if (!urlTag || !urlTag[1]) return false;

  try {
    return new URL(urlTag[1]).pathname.replace(/\/$/, "") ===
      expectedPath.replace(/\/$/, "");
  } catch {
    return false;
  }
}
