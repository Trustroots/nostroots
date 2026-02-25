import { Relay } from "nostr-tools/relay";
import { NOTIFICATION_SUBSCRIPTION_KIND } from "@trustroots/nr-common";
import type { NostrEvent } from "nostr-tools";
import type { SubscriptionStore } from "./subscriptionStore.ts";
import {
  decryptAndParseSubscription,
  isEncryptedForDaemon,
} from "./decrypt.ts";

export async function loadSubscriptionsFromRelay(
  relayUrl: string,
  privateKey: string,
  publicKey: string,
  store: SubscriptionStore,
): Promise<void> {
  console.log(`Connecting to relay: ${relayUrl}`);
  const relay = await Relay.connect(relayUrl);

  try {
    const events = await new Promise<readonly NostrEvent[]>(
      (resolve, reject) => {
        const collected: NostrEvent[] = [];

        const sub = relay.subscribe(
          [{ kinds: [NOTIFICATION_SUBSCRIPTION_KIND] }],
          {
            onevent(event: NostrEvent) {
              console.log(`Got stored event: ${event.id}`);
              collected.push(event);
            },
            oneose() {
              console.log("Finished reading stored events");
              sub.close();
              resolve(collected);
            },
          },
        );

        setTimeout(() => {
          sub.close();
          reject(new Error("Timeout waiting for stored events from relay"));
        }, 30000);
      },
    );

    const processedCount = await events.reduce(
      async (countPromise, event) => {
        const count = await countPromise;
        if (!isEncryptedForDaemon(event, publicKey)) {
          return count;
        }
        const result = await decryptAndParseSubscription(event, privateKey);
        if (result) {
          store.updateFilters(event.pubkey, result.filters);
          store.updateTokens(event.pubkey, result.tokens);
          return count + 1;
        }
        return count;
      },
      Promise.resolve(0),
    );

    console.log(
      `Loaded initial subscriptions from relay: ${store.pubkeyCount} pubkeys (${processedCount} events processed)`,
    );
  } finally {
    relay.close();
  }
}
