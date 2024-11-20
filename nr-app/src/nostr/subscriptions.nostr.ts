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
  filter,
  relayUrl,
  subscriptionId,
}: {
  filter: Filter;
  relayUrl: string;
  subscriptionId: string;
}) {
  const relay = await getRelay(relayUrl);

  const subscription = relay.subscribe([filter], {
    subscriptionId,
    onevent: (event: Event) => {
      store.dispatch(addEvent({ event, fromRelay: relayUrl }));
    },
    oneose: () => {
      store.dispatch(
        setSubscriptionHasSeenEOSE({ id: subscriptionId, relayUrl }),
      );
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
