import type { Event as NostrEvent, EventTemplate, Filter } from "nostr-tools";
import { Relay } from "nostr-tools";

import { signEventTemplate } from "@/nostr/keystore";
import { isHexKey } from "@/utils/hex";

export const TRUSTROOTS_RELAY_URL = "wss://relay.trustroots.org" as const;
export const TRUSTROOTS_NIP42_RELAY_URL = "wss://nip42.trustroots.org" as const;
export const TRUSTROOTS_IDENTITY_RELAY_URLS = [
  TRUSTROOTS_RELAY_URL,
  TRUSTROOTS_NIP42_RELAY_URL,
] as const;
export const TRUSTROOTS_PROFILE_KIND = 10390 as const;
export const TRUSTROOTS_PROFILE_CLAIM_KIND = 30390 as const;
export const TRUSTROOTS_USERNAME_LABEL_NAMESPACE =
  "org.trustroots:username" as const;

export type TrustrootsRelayRead = (filters: Filter[]) => Promise<NostrEvent[]>;

export function normalizeRelayAuthTemplate(
  template: EventTemplate,
  relayUrl: string,
): EventTemplate {
  let hasRelayTag = false;
  const tags = template.tags.map((tag) => {
    if (tag[0] !== "relay") return tag;
    hasRelayTag = true;
    return ["relay", relayUrl];
  });

  return {
    ...template,
    tags: hasRelayTag ? tags : [["relay", relayUrl], ...tags],
  };
}

function signRelayAuthTemplate(relayUrl: string) {
  return (template: EventTemplate) =>
    signEventTemplate(normalizeRelayAuthTemplate(template, relayUrl));
}

function normalizeUsername(value: unknown): string | null {
  const username = String(value || "").trim().toLowerCase();
  if (!username || !/^[a-z0-9_.-]+$/.test(username)) return null;
  return username;
}

export function normalizeTrustrootsNip05(value: unknown): string | null {
  const nip05 = String(value || "").trim().toLowerCase();
  const at = nip05.lastIndexOf("@");
  if (at <= 0 || at === nip05.length - 1) return null;

  const username = normalizeUsername(nip05.slice(0, at));
  const domain = nip05.slice(at + 1).replace(/^www\./, "");
  if (!username || domain !== "trustroots.org") return null;

  return `${username}@trustroots.org`;
}

function trustrootsNip05FromUsername(value: unknown): string | null {
  const username = normalizeUsername(value);
  return username ? `${username}@trustroots.org` : null;
}

function newestEvent(events: NostrEvent[]): NostrEvent | null {
  if (events.length === 0) return null;
  return events.reduce((latest, event) =>
    event.created_at >= latest.created_at ? event : latest,
  );
}

function matchesPubkey(event: NostrEvent, publicKeyHex: string): boolean {
  return event.pubkey.toLowerCase() === publicKeyHex.toLowerCase();
}

export function extractKind0TrustrootsNip05(
  events: NostrEvent[],
  publicKeyHex: string,
): string | null {
  const event = newestEvent(
    events.filter(
      (candidate) =>
        candidate.kind === 0 && matchesPubkey(candidate, publicKeyHex),
    ),
  );
  if (!event?.content) return null;

  try {
    const metadata = JSON.parse(event.content) as { nip05?: unknown };
    return normalizeTrustrootsNip05(metadata.nip05);
  } catch {
    return null;
  }
}

function trustrootsUsernameFromTags(tags: string[][]): string | null {
  for (const tag of tags) {
    if (tag[0] === "trustroots" && tag[1]) {
      return normalizeUsername(tag[1]);
    }
    if (
      tag[0] === "l" &&
      tag[1] &&
      tag[2] === TRUSTROOTS_USERNAME_LABEL_NAMESPACE
    ) {
      return normalizeUsername(tag[1]);
    }
  }
  return null;
}

export function extractKind10390TrustrootsNip05(
  events: NostrEvent[],
  publicKeyHex: string,
): string | null {
  const event = newestEvent(
    events.filter(
      (candidate) =>
        candidate.kind === TRUSTROOTS_PROFILE_KIND &&
        matchesPubkey(candidate, publicKeyHex),
    ),
  );
  return trustrootsNip05FromUsername(trustrootsUsernameFromTags(event?.tags || []));
}

function eventTargetsPubkey(event: NostrEvent, publicKeyHex: string): boolean {
  if (matchesPubkey(event, publicKeyHex)) return true;
  return event.tags.some(
    (tag) => tag[0] === "p" && tag[1]?.toLowerCase() === publicKeyHex.toLowerCase(),
  );
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

export function extractKind30390TrustrootsNip05(
  events: NostrEvent[],
  publicKeyHex: string,
): string | null {
  const candidates = events
    .filter(
      (candidate) =>
        candidate.kind === TRUSTROOTS_PROFILE_CLAIM_KIND &&
        eventTargetsPubkey(candidate, publicKeyHex),
    )
    .sort((a, b) => b.created_at - a.created_at);

  for (const event of candidates) {
    const fromTags = trustrootsNip05FromUsername(
      trustrootsUsernameFromTags(event.tags),
    );
    if (fromTags) return fromTags;

    const fromContent = trustrootsNip05FromClaimContent(event.content);
    if (fromContent) return fromContent;
  }

  return null;
}

export async function readTrustrootsRelayEvents(
  filters: Filter[],
  timeoutMs = 3200,
): Promise<NostrEvent[]> {
  const eventLists = await Promise.all(
    TRUSTROOTS_IDENTITY_RELAY_URLS.map((relayUrl) =>
      readTrustrootsRelayEventsFromRelay(relayUrl, filters, timeoutMs).catch(
        () => [],
      ),
    ),
  );
  return dedupeEvents(eventLists.flat());
}

async function readTrustrootsRelayEventsFromRelay(
  relayUrl: string,
  filters: Filter[],
  timeoutMs: number,
): Promise<NostrEvent[]> {
  const relay = new Relay(relayUrl);
  const signAuthEvent = signRelayAuthTemplate(relayUrl);
  relay.onauth = signAuthEvent;
  await relay.connect({ timeout: timeoutMs });
  const events: NostrEvent[] = [];

  await new Promise<void>((resolve) => {
    let settled = false;
    let didRetryAfterAuth = false;
    let timeout: ReturnType<typeof setTimeout>;
    let subscription: ReturnType<typeof relay.subscribe> | null = null;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        subscription?.close();
      } catch {}
      try {
        relay.close();
      } catch {}
      resolve();
    };
    const subscribe = () => {
      subscription = relay.subscribe(filters, {
        onevent: (event) => {
          events.push(event);
        },
        oneose: settle,
        onclose: (reason) => {
          if (reason.startsWith("auth-required:") && !didRetryAfterAuth) {
            didRetryAfterAuth = true;
            relay
              .auth(signAuthEvent)
              .then(subscribe)
              .catch(settle);
            return;
          }
          settle();
        },
      });
    };
    timeout = setTimeout(settle, timeoutMs);
    subscribe();
  });

  return events;
}

function dedupeEvents(events: NostrEvent[]): NostrEvent[] {
  const byId = new Map<string, NostrEvent>();
  for (const event of events) {
    byId.set(event.id, event);
  }
  return [...byId.values()];
}

export async function lookupTrustrootsNip05(
  publicKeyHex: string,
  readEvents: TrustrootsRelayRead = readTrustrootsRelayEvents,
): Promise<string | null> {
  const normalizedPubkey = publicKeyHex.toLowerCase();
  if (!isHexKey(normalizedPubkey)) return null;

  try {
    const kind0Events = await readEvents([
      { kinds: [0], authors: [normalizedPubkey], limit: 5 },
    ]);
    const kind0Nip05 = extractKind0TrustrootsNip05(kind0Events, normalizedPubkey);
    if (kind0Nip05) return kind0Nip05;

    const kind10390Events = await readEvents([
      {
        kinds: [TRUSTROOTS_PROFILE_KIND],
        authors: [normalizedPubkey],
        limit: 5,
      },
    ]);
    const kind10390Nip05 = extractKind10390TrustrootsNip05(
      kind10390Events,
      normalizedPubkey,
    );
    if (kind10390Nip05) return kind10390Nip05;

    const kind30390Events = await readEvents([
      {
        kinds: [TRUSTROOTS_PROFILE_CLAIM_KIND],
        "#p": [normalizedPubkey],
        limit: 20,
      },
      {
        kinds: [TRUSTROOTS_PROFILE_CLAIM_KIND],
        authors: [normalizedPubkey],
        limit: 20,
      },
    ]);
    const kind30390Nip05 = extractKind30390TrustrootsNip05(
      kind30390Events,
      normalizedPubkey,
    );
    if (kind30390Nip05) return kind30390Nip05;

    const broadProfileEvents = await readEvents([
      { kinds: [0, TRUSTROOTS_PROFILE_KIND], limit: 5000 },
      { kinds: [TRUSTROOTS_PROFILE_CLAIM_KIND], limit: 5000 },
    ]);
    return (
      extractKind0TrustrootsNip05(broadProfileEvents, normalizedPubkey) ||
      extractKind10390TrustrootsNip05(broadProfileEvents, normalizedPubkey) ||
      extractKind30390TrustrootsNip05(broadProfileEvents, normalizedPubkey)
    );
  } catch {
    return null;
  }
}
