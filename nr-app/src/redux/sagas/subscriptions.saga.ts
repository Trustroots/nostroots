import {
  getSubscription,
  subscribeToFilter,
} from "@/nostr/subscriptions.nostr";
import { Subscription } from "nostr-tools/lib/types/abstract-relay";
import { all, call, fork, StrictEffect, takeEvery } from "redux-saga/effects";
import {
  startSubscription,
  stopSubscription,
} from "../actions/subscription.actions";
import { AppStore } from "../store";

// NOTE: This pattern is required to avoid a circular import dependency
let store: AppStore;
export function injectStore(_store: AppStore) {
  store = _store;
}

function getRelayUrlsOrDefaults(relayUrls?: string[]) {
  if (typeof relayUrls === "undefined" || relayUrls.length === 0) {
    // TODO: Get defaults from redux
    const defaultRelayUrls = ["wss://nos.lol"];
    return defaultRelayUrls;
  }

  return relayUrls;
}

function* startSubscriptionSagaEffect(
  action: ReturnType<typeof startSubscription>,
) {
  const { filter, id, relayUrls } = action.payload;

  const actualRelayUrls = getRelayUrlsOrDefaults(relayUrls);

  for (const relayUrl of actualRelayUrls) {
    yield fork(subscribeToFilter, {
      filter,
      relayUrl,
      subscriptionId: id,
      store,
    });
  }
}

export function* startSubscriptionSaga() {
  yield takeEvery(startSubscription, startSubscriptionSagaEffect);
}

function* stopSubscriptionSagaEffect(
  action: ReturnType<typeof stopSubscription>,
): Generator<StrictEffect, void, Subscription> {
  const subscription = yield call(getSubscription, action.payload);
  yield call(subscription.close);
}

function* stopSubscriptionSaga() {
  yield takeEvery(stopSubscription, stopSubscriptionSagaEffect);
}

export default function* subscriptionSaga() {
  yield all([startSubscriptionSaga(), stopSubscriptionSaga()]);
}
