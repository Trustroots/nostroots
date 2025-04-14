import { addEvent } from "@/redux/slices/events.slice";
import { setSubscriptionHasSeenEOSE } from "@/redux/slices/relays.slice";
import { Event, Filter } from "nostr-tools";
import { Subscription } from "nostr-tools/lib/types/abstract-relay";
import { getRelay } from "./relays.nostr";
import { AppStore } from "@/redux/store";

// NOTE: This pattern is required to avoid a circular import dependency
let store: AppStore;
export function injectStore(_store: AppStore) {
  store = _store;
}

const subscriptions = new Map<string, Subscription>();

/**
 * - The relays are not linked to redux currently
 * - We should set it up to log relay state into redux
 * - Then we can push subscription state
 * - Then we can update subscription state
 */

export async function subscribeToFilter({
  filters,
  relayUrl,
  subscriptionId,
}: {
  filters: Filter[];
  relayUrl: string;
  subscriptionId: string;
}) {
  const relay = await getRelay(relayUrl);

  const subscription = relay.subscribe(filters, {
    subscriptionId,
    onevent: (event: Event) => {
      try {
        store.dispatch(addEvent({ event, fromRelay: relayUrl }));
      } catch (error) {
        console.error("#ROkIr5 Caught error in store.dispatch()", error);
      }
    },
    oneose: () => {
      try {
        store.dispatch(
          setSubscriptionHasSeenEOSE({ id: subscriptionId, relayUrl }),
        );
      } catch (error) {
        console.error("#6duput Caught error in store.dispatch()", error);
      }
    },
    // NOTE: Type casting here because `id` is not available on `.subscribe()`
    // https://github.com/nbd-wtf/nostr-tools/issues/439
  } as object);

  subscriptions.set(subscriptionId, subscription);

  return subscriptionId;
}

export function getSubscription(id: string) {
  const subscription = subscriptions.get(id);
  if (typeof subscription === "undefined") {
    throw new Error("Tried to get invalid subscription by ID #MITKA7");
  }
  return subscription;
}

export function stopSubscription(id: string) {
  if (!subscriptions.has(id)) {
    return;
  }
  const subscription = getSubscription(id);
  subscription.close();
  // What are the implications of deleting a subscription after stopping it?
  subscriptions.delete(id);
}
