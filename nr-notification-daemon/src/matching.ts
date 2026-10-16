import { matchFilter } from "nostr-tools";
import type { NostrEvent } from "nostr-tools";
import { getAuthorFromEvent } from "@trustroots/nr-common";
import { log } from "./log.ts";
import { Nip5VerificationError, resolveUsername } from "./profiles.ts";
import { sendPushNotifications } from "./push.ts";
import type { PushToken, SubscriptionStore } from "./subscriptionStore.ts";

export async function matchAndNotify(
  event: NostrEvent,
  store: SubscriptionStore,
  expoAccessToken: string,
  relayUrl: string,
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

  const authorPubkey = getAuthorFromEvent(event) ?? event.pubkey;

  const username = await resolveUsername(authorPubkey, relayUrl).catch(
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

  const sentTokens = new Set<PushToken>();
  const batches = [...new Set(matchingPairs.map(({ pubkey }) => pubkey))]
    .map((pubkey) => {
      const tokens = (store.getTokensForPubkey(pubkey) ?? []).filter(
        (token) => !sentTokens.has(token),
      );
      tokens.forEach((token) => sentTokens.add(token));
      if (tokens.length === 0) {
        log.debug(`No new push tokens for pubkey ${pubkey}`);
      }
      return tokens;
    })
    .filter((tokens) => tokens.length > 0);

  await Promise.all(
    batches.map((tokens) =>
      sendPushNotifications(tokens, event, expoAccessToken, username)
    ),
  );
}
