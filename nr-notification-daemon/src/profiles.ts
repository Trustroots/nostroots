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

const usernameCache = new Map<string, string>();

export async function resolveUsername(
  pubkey: string,
  relayUrl: string,
): Promise<string | undefined> {
  const cached = usernameCache.get(pubkey);
  if (cached) {
    return cached;
  }

  const profileEvent = await fetchProfileEvent(pubkey, relayUrl);
  if (!profileEvent) {
    return undefined;
  }

  const username = getFirstLabelValueFromTags(
    profileEvent.tags,
    TRUSTROOTS_USERNAME_LABEL_NAMESPACE,
  );
  if (!username) {
    return undefined;
  }

  const nip5Pubkey = await getNip5PubKey(username);
  if (nip5Pubkey !== pubkey) {
    throw new Nip5VerificationError(pubkey, username, nip5Pubkey);
  }

  usernameCache.set(pubkey, username);
  return username;
}

async function fetchProfileEvent(
  pubkey: string,
  relayUrl: string,
): Promise<NostrEvent | undefined> {
  const relay = await Relay.connect(relayUrl);

  try {
    return await new Promise<NostrEvent | undefined>((resolve) => {
      const sub = relay.subscribe(
        [{ kinds: [TRUSTROOTS_PROFILE_KIND], authors: [pubkey] }],
        {
          onevent(event: NostrEvent) {
            sub.close();
            resolve(event);
          },
          oneose() {
            sub.close();
            resolve(undefined);
          },
        },
      );

      setTimeout(() => {
        sub.close();
        resolve(undefined);
      }, 5000);
    });
  } finally {
    relay.close();
  }
}
