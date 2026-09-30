import { matchFilter } from "nostr-tools";
import type { NostrEvent } from "nostr-tools";
import { getAuthorFromEvent } from "@trustroots/nr-common";
import { log } from "./log.ts";
import { Nip5VerificationError, resolveUsername } from "./profiles.ts";
import { sendPushNotifications } from "./push.ts";
import { SeenEvents } from "./seenEvents.ts";
import type { PushToken, SubscriptionStore } from "./subscriptionStore.ts";

export interface NotifyDeps {
  readonly seenEvents: SeenEvents;
  readonly resolveUsername: typeof resolveUsername;
  readonly sendPushNotifications: typeof sendPushNotifications;
}

const defaultDeps: NotifyDeps = {
  seenEvents: new SeenEvents(),
  resolveUsername,
  sendPushNotifications,
};

export async function matchAndNotify(
  event: NostrEvent,
  store: SubscriptionStore,
  expoAccessToken: string,
  relayUrl: string,
  deps: NotifyDeps = defaultDeps,
): Promise<void> {
  const pairs = store.getAllFilterPubkeyPairs();

  const matchingPairs = pairs.filter(({ filter }) =>
    matchFilter(filter, event)
  );

  if (matchingPairs.length === 0) {
    log.debug(`No filter matches for event kind ${event.kind}`);
    return;
  }

  log.info(`Event matched ${matchingPairs.length} filters`);

  // One push per device: a subscriber can match through several filters, and
  // a device token can be registered under more than one pubkey.
  const tokensByPubkey = new Map<string, PushToken[]>();
  const claimedTokens = new Set<PushToken>();
  for (const { pubkey } of matchingPairs) {
    if (tokensByPubkey.has(pubkey)) continue;
    const tokens = (store.getTokensForPubkey(pubkey) ?? []).filter(
      (token) => !claimedTokens.has(token),
    );
    tokens.forEach((token) => claimedTokens.add(token));
    tokensByPubkey.set(pubkey, tokens);
  }
  const recipients = [...tokensByPubkey]
    .filter(([pubkey, tokens]) => {
      if (tokens.length === 0) log.debug(`No push tokens for pubkey ${pubkey}`);
      return tokens.length > 0;
    })
    .map(([pubkey, tokens]) => ({ pubkey, tokens }));

  if (recipients.length === 0) {
    return;
  }

  const authorPubkey = getAuthorFromEvent(event) ?? event.pubkey;

  const username = await deps.resolveUsername(authorPubkey, relayUrl).catch(
    (error) => {
      if (error instanceof Nip5VerificationError) {
        log.error(
          `#q6on2y ERROR NIP-5 verification failed for event ${event.id}. Author pubkey ${error.pubkey} claims username "${error.claimedUsername}" but NIP-5 returned pubkey ${
            error.nip5Pubkey ?? "undefined"
          }. Dropping notification. Full event: ${JSON.stringify(event)}`,
        );
        return null;
      }
      throw error;
    },
  );

  if (username === null) {
    return;
  }

  // Marked before sending: a redelivery after a failure mid-send is dropped
  // rather than risking a duplicate push.
  if (!deps.seenEvents.markIfNew(event.id)) {
    log.info(`Already notified for event ${event.id}, skipping`);
    return;
  }

  await Promise.all(
    recipients.map(async ({ pubkey, tokens }) => {
      log.debug(`Filter matched event kind ${event.kind} for pubkey ${pubkey}`);
      await deps.sendPushNotifications(
        tokens,
        event,
        expoAccessToken,
        username,
      );
    }),
  );
}
