import type { EventTemplate } from "nostr-tools";

import { isHexKey } from "./hex";
import { signNostrEvent } from "./nostr";

export const TRUSTROOTS_RELAY_URL = "wss://relay.trustroots.org";
export const TRUSTROOTS_NIP42_RELAY_URL = "wss://nip42.trustroots.org";
export const TRUSTROOTS_IDENTITY_RELAY_URLS = [
  TRUSTROOTS_RELAY_URL,
  TRUSTROOTS_NIP42_RELAY_URL,
] as const;

export const TRUSTROOTS_PROFILE_KIND = 10390;
export const TRUSTROOTS_PROFILE_CLAIM_KIND = 30390;
export const TRUSTROOTS_USERNAME_LABEL_NAMESPACE = "org.trustroots:username";
export const NIP42_AUTH_KIND = 22242;

export type NostrEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig?: string;
};

export type NostrFilter = {
  kinds?: number[];
  authors?: string[];
  "#p"?: string[];
  limit?: number;
};

export type TrustrootsRelayRead = (filters: NostrFilter[]) => Promise<NostrEvent[]>;

function normalizeUsername(value: unknown): string | null {
  const username = String(value || "").trim().toLowerCase();
  return username && /^[a-z0-9_.-]+$/.test(username) ? username : null;
}

export function normalizeTrustrootsNip05(value: unknown): string | null {
  const nip05 = String(value || "").trim().toLowerCase();
  const at = nip05.lastIndexOf("@");
  if (at <= 0 || at === nip05.length - 1) return null;

  const username = normalizeUsername(nip05.slice(0, at));
  const domain = nip05.slice(at + 1).replace(/^www\./, "");
  return username && domain === "trustroots.org" ? `${username}@trustroots.org` : null;
}

function trustrootsNip05FromUsername(value: unknown): string | null {
  const username = normalizeUsername(value);
  return username ? `${username}@trustroots.org` : null;
}

function newestEvent(events: NostrEvent[]): NostrEvent | null {
  if (events.length === 0) return null;
  return events.reduce((latest, event) =>
    Number(event.created_at || 0) >= Number(latest.created_at || 0) ? event : latest,
  );
}

function matchesPubkey(event: NostrEvent, publicKeyHex: string): boolean {
  return String(event.pubkey || "").toLowerCase() === publicKeyHex;
}

export function extractKind0TrustrootsNip05(events: NostrEvent[], publicKeyHex: string): string | null {
  const event = newestEvent(events.filter((candidate) => candidate.kind === 0 && matchesPubkey(candidate, publicKeyHex)));
  if (!event?.content) return null;

  try {
    const metadata = JSON.parse(event.content) as { nip05?: unknown };
    return normalizeTrustrootsNip05(metadata.nip05);
  } catch {
    return null;
  }
}

function trustrootsUsernameFromTags(tags: string[][]): string | null {
  for (const tag of tags || []) {
    if (tag[0] === "trustroots" && tag[1]) return normalizeUsername(tag[1]);
    if (tag[0] === "l" && tag[1] && tag[2] === TRUSTROOTS_USERNAME_LABEL_NAMESPACE) {
      return normalizeUsername(tag[1]);
    }
  }
  return null;
}

export function extractKind10390TrustrootsNip05(events: NostrEvent[], publicKeyHex: string): string | null {
  const event = newestEvent(
    events.filter((candidate) => candidate.kind === TRUSTROOTS_PROFILE_KIND && matchesPubkey(candidate, publicKeyHex)),
  );
  return trustrootsNip05FromUsername(trustrootsUsernameFromTags(event?.tags || []));
}

function eventTargetsPubkey(event: NostrEvent, publicKeyHex: string): boolean {
  if (matchesPubkey(event, publicKeyHex)) return true;
  return event.tags.some((tag) => tag[0] === "p" && tag[1]?.toLowerCase() === publicKeyHex);
}

function trustrootsNip05FromClaimContent(content: string): string | null {
  try {
    const metadata = JSON.parse(content) as {
      nip05?: unknown;
      trustrootsUsername?: unknown;
      username?: unknown;
    };
    return (
      normalizeTrustrootsNip05(metadata.nip05) ||
      trustrootsNip05FromUsername(metadata.trustrootsUsername) ||
      trustrootsNip05FromUsername(metadata.username)
    );
  } catch {
    return null;
  }
}

export function extractKind30390TrustrootsNip05(events: NostrEvent[], publicKeyHex: string): string | null {
  const candidates = events
    .filter((candidate) => candidate.kind === TRUSTROOTS_PROFILE_CLAIM_KIND && eventTargetsPubkey(candidate, publicKeyHex))
    .sort((left, right) => right.created_at - left.created_at);

  for (const event of candidates) {
    const fromTags = trustrootsNip05FromUsername(trustrootsUsernameFromTags(event.tags));
    if (fromTags) return fromTags;

    const fromContent = trustrootsNip05FromClaimContent(event.content);
    if (fromContent) return fromContent;
  }

  return null;
}

export async function lookupTrustrootsNip05(
  publicKeyHex: string,
  privateKeyHex: string,
  readEvents: TrustrootsRelayRead = (filters) => readTrustrootsRelayEvents(filters, privateKeyHex),
): Promise<string | null> {
  const normalizedPubkey = publicKeyHex.toLowerCase();
  if (!isHexKey(normalizedPubkey) || !isHexKey(privateKeyHex)) return null;

  try {
    const kind0Events = await readEvents([{ kinds: [0], authors: [normalizedPubkey], limit: 5 }]);
    const kind0Nip05 = extractKind0TrustrootsNip05(kind0Events, normalizedPubkey);
    if (kind0Nip05) return kind0Nip05;

    const kind10390Events = await readEvents([
      { kinds: [TRUSTROOTS_PROFILE_KIND], authors: [normalizedPubkey], limit: 5 },
    ]);
    const kind10390Nip05 = extractKind10390TrustrootsNip05(kind10390Events, normalizedPubkey);
    if (kind10390Nip05) return kind10390Nip05;

    const kind30390Events = await readEvents([
      { kinds: [TRUSTROOTS_PROFILE_CLAIM_KIND], "#p": [normalizedPubkey], limit: 20 },
      { kinds: [TRUSTROOTS_PROFILE_CLAIM_KIND], authors: [normalizedPubkey], limit: 20 },
    ]);
    const kind30390Nip05 = extractKind30390TrustrootsNip05(kind30390Events, normalizedPubkey);
    if (kind30390Nip05) return kind30390Nip05;

    const broadEvents = await readEvents([
      { kinds: [0, TRUSTROOTS_PROFILE_KIND], limit: 5000 },
      { kinds: [TRUSTROOTS_PROFILE_CLAIM_KIND], limit: 5000 },
    ]);
    return (
      extractKind0TrustrootsNip05(broadEvents, normalizedPubkey) ||
      extractKind10390TrustrootsNip05(broadEvents, normalizedPubkey) ||
      extractKind30390TrustrootsNip05(broadEvents, normalizedPubkey)
    );
  } catch {
    return null;
  }
}

export async function readTrustrootsRelayEvents(filters: NostrFilter[], privateKeyHex: string): Promise<NostrEvent[]> {
  const results = await Promise.all(
    TRUSTROOTS_IDENTITY_RELAY_URLS.map((relayUrl) =>
      readTrustrootsRelayEventsFromRelay(relayUrl, filters, privateKeyHex).catch(() => []),
    ),
  );
  return dedupeEvents(results.flat());
}

function readTrustrootsRelayEventsFromRelay(
  relayUrl: string,
  filters: NostrFilter[],
  privateKeyHex: string,
  timeoutMs = 3200,
): Promise<NostrEvent[]> {
  return new Promise((resolve) => {
    const events: NostrEvent[] = [];
    const subscriptionId = `nr-ext-${Math.random().toString(36).slice(2)}`;
    let settled = false;
    let didRetryAfterAuth = false;
    let timeout: ReturnType<typeof setTimeout>;
    let ws: WebSocket;

    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        ws?.close();
      } catch {
        // Already closed.
      }
      resolve(events);
    };

    const subscribe = () => {
      try {
        ws.send(JSON.stringify(["REQ", subscriptionId, ...filters]));
      } catch {
        settle();
      }
    };

    try {
      ws = new WebSocket(relayUrl);
    } catch {
      resolve([]);
      return;
    }

    timeout = setTimeout(settle, timeoutMs);
    ws.addEventListener("open", subscribe);
    ws.addEventListener("error", settle);
    ws.addEventListener("close", settle);
    ws.addEventListener("message", (message) => {
      const data = parseRelayMessage(message.data);
      if (!Array.isArray(data)) return;

      if (data[0] === "EVENT" && isNostrEvent(data[2])) {
        events.push(data[2]);
        return;
      }

      if (data[0] === "EOSE") {
        settle();
        return;
      }

      if (data[0] === "AUTH" && typeof data[1] === "string") {
        const authTemplate: EventTemplate = {
          kind: NIP42_AUTH_KIND,
          created_at: Math.floor(Date.now() / 1000),
          content: "",
          tags: [
            ["relay", relayUrl],
            ["challenge", data[1]],
          ],
        };
        try {
          ws.send(JSON.stringify(["AUTH", signNostrEvent(privateKeyHex, authTemplate)]));
        } catch {
          // If auth signing fails, the read will simply settle without private relay data.
        }
        return;
      }

      if (data[0] === "CLOSED" && String(data[2] || "").startsWith("auth-required:") && !didRetryAfterAuth) {
        didRetryAfterAuth = true;
        subscribe();
      }
    });
  });
}

function parseRelayMessage(value: unknown): unknown {
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function isNostrEvent(value: unknown): value is NostrEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as NostrEvent).id === "string" &&
    typeof (value as NostrEvent).pubkey === "string" &&
    typeof (value as NostrEvent).kind === "number" &&
    Array.isArray((value as NostrEvent).tags) &&
    typeof (value as NostrEvent).content === "string"
  );
}

function dedupeEvents(events: NostrEvent[]): NostrEvent[] {
  const byId = new Map<string, NostrEvent>();
  for (const event of events) {
    byId.set(event.id, event);
  }
  return [...byId.values()];
}
