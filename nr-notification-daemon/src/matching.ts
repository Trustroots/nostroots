import { matchFilter } from "nostr-tools";
import type { NostrEvent } from "nostr-tools";
import type { SubscriptionStore } from "./subscriptionStore.ts";
import { sendPushNotifications } from "./push.ts";

export async function matchAndNotify(
  event: NostrEvent,
  store: SubscriptionStore,
  expoAccessToken: string,
): Promise<void> {
  const pairs = store.getAllFilterPubkeyPairs();

  const matchingPairs = pairs.filter(({ filter }) =>
    matchFilter(filter, event)
  );

  if (matchingPairs.length === 0) {
    console.log(`No filter matches for event kind ${event.kind}`);
    return;
  }

  console.log(`Event matched ${matchingPairs.length} filters`);

  await Promise.all(
    matchingPairs.map(async ({ pubkey }) => {
      console.log(
        `Filter matched event kind ${event.kind} for pubkey ${pubkey}`,
      );
      const tokens = store.getTokensForPubkey(pubkey);
      if (!tokens || tokens.length === 0) {
        console.log(`No push tokens for pubkey ${pubkey}`);
        return;
      }
      await sendPushNotifications(tokens, event, expoAccessToken);
    }),
  );
}
