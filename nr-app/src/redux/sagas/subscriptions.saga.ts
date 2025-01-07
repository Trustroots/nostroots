import {
  getSubscription,
  subscribeToFilter,
} from "@/nostr/subscriptions.nostr";
import { DEFAULT_RELAY_URL } from "@trustroots/nr-common";
import { Subscription } from "nostr-tools/lib/types/abstract-relay";
import {
  all,
  call,
  fork,
  put,
  StrictEffect,
  takeEvery,
} from "redux-saga/effects";
import {
  startSubscription,
  stopSubscription,
} from "../actions/subscription.actions";
import { setSubscription } from "../slices/relays.slice";
import { nanoid } from "@reduxjs/toolkit";

function getRelayUrlsOrDefaults(relayUrls?: string[]) {
  if (typeof relayUrls === "undefined" || relayUrls.length === 0) {
    // TODO: Get defaults from redux
    const defaultRelayUrls = [DEFAULT_RELAY_URL];
    return defaultRelayUrls;
  }

  return relayUrls;
}

// TODO: Handle network failures here, they will throw
function* startSubscriptionSagaEffect(
  action: ReturnType<typeof startSubscription>,
) {
  const { filters, id, relayUrls } = action.payload;

  const actualRelayUrls = getRelayUrlsOrDefaults(relayUrls);

  const isNewSubscription = typeof id === "undefined";
  const subscriptionId = isNewSubscription ? nanoid() : id;

  // TODO Stop here if the subscription is not new and hasn't changed

  if (!isNewSubscription) {
    yield call(stopSubscription, subscriptionId);
  }

  yield put(
    setSubscription({
      subscriptionId,
      query: filters,
      relaysStatus: Object.fromEntries(
        actualRelayUrls.map((url) => [
          url,
          {
            hasSeenEOSE: false,
            isOpen: false,
          },
        ]),
      ),
    }),
  );

  for (const relayUrl of actualRelayUrls) {
    yield fork(subscribeToFilter, {
      filters,
      relayUrl,
      subscriptionId,
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
