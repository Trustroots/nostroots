import { matchFilter } from "nostr-tools";
import type { NostrEvent } from "nostr-tools";
import type { APNSConfig } from "./config.ts";
import { sendAPNSNotification } from "./apns.ts";
import { log } from "./log.ts";
import type { SubscriptionStore } from "./subscriptionStore.ts";
import type { APNSToken } from "./schema.ts";

export type APNSSender = (
  token: APNSToken,
  event: NostrEvent,
  config: APNSConfig,
  username?: string,
) => Promise<void>;

export async function matchAndNotify(
  event: NostrEvent,
  store: SubscriptionStore,
  apns: APNSConfig,
  send: APNSSender = sendAPNSNotification,
): Promise<void> {
  const matchingPairs = store.getAllFilterPubkeyPairs().filter(({ filter }) =>
    matchFilter(filter, event)
  );
  if (matchingPairs.length === 0) {
    log.debug(`No Vibe push filter matches for event kind ${event.kind}`);
    return;
  }

  await Promise.all(matchingPairs.map(async ({ pubkey }) => {
    const tokens = store.getTokensForPubkey(pubkey);
    if (tokens.length === 0) {
      log.debug(`No APNs tokens for pubkey ${pubkey}`);
      return;
    }
    await Promise.all(tokens.map((token) => send(token, event, apns)));
  }));
}
