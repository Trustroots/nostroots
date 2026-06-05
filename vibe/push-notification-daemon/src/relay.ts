import { Relay } from "nostr-tools/relay";
import type { NostrEvent } from "nostr-tools";
import { VIBE_NOTIFICATION_SUBSCRIPTION_KIND } from "./constants.ts";
import { decryptAndParseSubscription, isEncryptedForDaemon } from "./decrypt.ts";
import { log } from "./log.ts";
import type { SubscriptionStore } from "./subscriptionStore.ts";

export async function loadSubscriptionsFromRelay(
  relayUrl: string,
  privateKey: string,
  publicKey: string,
  store: SubscriptionStore,
): Promise<void> {
  log.info(`Connecting to relay for Vibe subscriptions: ${relayUrl}`);
  const relay = await Relay.connect(relayUrl);
  try {
    await new Promise<void>((resolve, reject) => {
      const sub = relay.subscribe([{ kinds: [VIBE_NOTIFICATION_SUBSCRIPTION_KIND] }], {
        async onevent(event: NostrEvent) {
          if (!isEncryptedForDaemon(event, publicKey)) return;
          const payload = await decryptAndParseSubscription(event, privateKey);
          if (!payload) return;
          store.update(event.pubkey, payload.filters.map((f) => f.filter), payload.tokens);
        },
        oneose() {
          sub.close();
          resolve();
        },
      });
      setTimeout(() => {
        sub.close();
        reject(new Error("Timeout waiting for Vibe subscription events."));
      }, 30000);
    });
  } finally {
    relay.close();
  }
}
