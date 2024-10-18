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

function generateId() {
  return Math.random().toString().slice(2);
}

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
  subscriptionId?: string;
}) {
  const relay = await getRelay(relayUrl);

  const id =
    typeof subscriptionId === "string" && subscriptionId.length > 3
      ? subscriptionId
      : generateId();

  const subscription = relay.subscribe([filter], {
    id,
    onevent: (event: Event) => {
      store.dispatch(addEvent({ event, fromRelay: relayUrl }));
    },
    oneose: () => {
      store.dispatch(setSubscriptionHasSeenEOSE({ id, relayUrl }));
    },
    // NOTE: Type casting here because `id` is not available on `.subscribe()`
    // https://github.com/nbd-wtf/nostr-tools/issues/439
  } as {});

  subscriptions.set(id, subscription);

  return id;
}

export function getSubscription(id: string) {
  const subscription = subscriptions.get(id);
  if (typeof subscription === "undefined") {
    throw new Error("Tried to get invalid subscription by ID #MITKA7");
  }
  return subscription;
}
