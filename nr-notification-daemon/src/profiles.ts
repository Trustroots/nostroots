import { Relay } from "nostr-tools/relay";
import type { NostrEvent } from "nostr-tools";
import {
  getFirstLabelValueFromTags,
  getNip5PubKey,
  TRUSTROOTS_PROFILE_KIND,
  TRUSTROOTS_USERNAME_LABEL_NAMESPACE,
} from "@trustroots/nr-common";

export class Nip5VerificationError extends Error {
  constructor(
    public readonly pubkey: string,
    public readonly claimedUsername: string,
    public readonly nip5Pubkey: string | undefined,
  ) {
    super(
      `NIP-5 verification failed: pubkey ${pubkey} claims username "${claimedUsername}" but NIP-5 returned pubkey ${
        nip5Pubkey ?? "undefined"
      }`,
    );
    this.name = "Nip5VerificationError";
  }
}

const PROFILE_TIMEOUT_MS = 5000;
const MISS_TTL_MS = 5 * 60 * 1000;

const usernameCache = new Map<string, string>();
const missCache = new Map<string, number>();
const inFlight = new Map<string, Promise<string | undefined>>();

export function resolveUsername(
  pubkey: string,
  relayUrl: string,
): Promise<string | undefined> {
  const cached = usernameCache.get(pubkey);
  if (cached) {
    return Promise.resolve(cached);
  }

  const missedAt = missCache.get(pubkey);
  if (missedAt !== undefined) {
    if (Date.now() - missedAt < MISS_TTL_MS) {
      return Promise.resolve(undefined);
    }
    missCache.delete(pubkey);
  }

  const pending = inFlight.get(pubkey);
  if (pending) {
    return pending;
  }

  const lookup = lookupUsername(pubkey, relayUrl).finally(() => {
    inFlight.delete(pubkey);
  });
  inFlight.set(pubkey, lookup);
  return lookup;
}

async function lookupUsername(
  pubkey: string,
  relayUrl: string,
): Promise<string | undefined> {
  const profileEvent = await fetchProfileEvent(pubkey, relayUrl);
  if (profileEvent === "timeout") {
    return undefined;
  }

  const username = profileEvent &&
    getFirstLabelValueFromTags(
      profileEvent.tags,
      TRUSTROOTS_USERNAME_LABEL_NAMESPACE,
    );
  if (!username) {
    rememberMiss(pubkey);
    return undefined;
  }

  const nip5Pubkey = await getNip5PubKey(username);
  if (nip5Pubkey !== pubkey) {
    throw new Nip5VerificationError(pubkey, username, nip5Pubkey);
  }

  usernameCache.set(pubkey, username);
  return username;
}

function rememberMiss(pubkey: string) {
  const now = Date.now();
  for (const [key, missedAt] of missCache) {
    if (now - missedAt >= MISS_TTL_MS) {
      missCache.delete(key);
    }
  }
  missCache.set(pubkey, now);
}

// nostr-tools fires oneose itself once eoseTimeout passes, so a silent relay
// looks like EOSE; the elapsed time tells the two apart.
async function fetchProfileEvent(
  pubkey: string,
  relayUrl: string,
): Promise<NostrEvent | undefined | "timeout"> {
  const relay = await Relay.connect(relayUrl);
  const startedAt = Date.now();

  try {
    return await new Promise<NostrEvent | undefined | "timeout">((resolve) => {
      let found: NostrEvent | undefined;
      const sub = relay.subscribe(
        [{ kinds: [TRUSTROOTS_PROFILE_KIND], authors: [pubkey] }],
        {
          eoseTimeout: PROFILE_TIMEOUT_MS,
          onevent(event: NostrEvent) {
            found = event;
          },
          oneose() {
            sub.close();
            const timedOut = Date.now() - startedAt >= PROFILE_TIMEOUT_MS;
            resolve(found ?? (timedOut ? "timeout" : undefined));
          },
        },
      );
    });
  } finally {
    relay.close();
  }
}
