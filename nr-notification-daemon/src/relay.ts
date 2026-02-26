import { Relay } from "nostr-tools/relay";
import { NOTIFICATION_SUBSCRIPTION_KIND } from "@trustroots/nr-common";
import type { NostrEvent } from "nostr-tools";
import {
  decryptAndParseSubscription,
  isEncryptedForDaemon,
} from "./decrypt.ts";
import { log } from "./log.ts";
import type { SubscriptionStore } from "./subscriptionStore.ts";

export async function loadSubscriptionsFromRelay(
  relayUrl: string,
  privateKey: string,
  publicKey: string,
  store: SubscriptionStore,
): Promise<void> {
  log.info(`#uWfe4I Connecting to relay: ${relayUrl}`);
  const relay = await Relay.connect(relayUrl);

  try {
    await new Promise<void>((resolve, reject) => {
      const sub = relay.subscribe(
        [{ kinds: [NOTIFICATION_SUBSCRIPTION_KIND] }],
        {
          async onevent(event: NostrEvent) {
            log.debug(`#nob1Wi Got stored event: ${event.id}`);
            if (!isEncryptedForDaemon(event, publicKey)) {
              return;
            }
            const result = await decryptAndParseSubscription(
              event,
              privateKey,
            );
            if (result) {
              store.updateFilters(event.pubkey, result.filters);
              store.updateTokens(event.pubkey, result.tokens);
            }
          },
          oneose() {
            log.info("#07CfoY Finished reading stored events");
            sub.close();
            resolve();
          },
        },
      );

      setTimeout(() => {
        sub.close();
        reject(
          new Error("Timeout waiting for stored events from relay #QrTY6a"),
        );
      }, 30000);
    });

    log.info(`#yXyIJX Loaded initial subscriptions from relay: ${store.pubkeyCount} pubkeys`);
  } finally {
    relay.close();
  }
}
