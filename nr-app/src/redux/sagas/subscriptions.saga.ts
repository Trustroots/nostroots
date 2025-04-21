import {
  getSubscription,
  subscribeToFilter,
} from "@/nostr/subscriptions.nostr";
import { nanoid } from "@reduxjs/toolkit";
import {
  DEFAULT_RELAY_URL,
  getAuthorFromEvent,
  TRUSTROOTS_PROFILE_KIND,
} from "@trustroots/nr-common";
import { Subscription } from "nostr-tools/lib/types/abstract-relay";
import {
  all,
  call,
  debounce,
  fork,
  put,
  select,
  StrictEffect,
  takeEvery,
} from "redux-saga/effects";
import {
  startSubscription,
  stopSubscription,
} from "../actions/subscription.actions";
import { addEvent, eventsSelectors } from "../slices/events.slice";
import { relaySelectors, setSubscription } from "../slices/relays.slice";
import { RootState } from "../store";

const AUTHOR_SUBSCRIPTION_ID = "authorSubscription";

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

function selectEventsAndSubscription(state: RootState) {
  const eventsWithMetadata = eventsSelectors.selectAll(state);
  const existingSubscription = relaySelectors.selectSubscription(
    state,
    AUTHOR_SUBSCRIPTION_ID,
  );
  return { eventsWithMetadata, existingSubscription };
}

function* subscribeToUserProfilesSagaEffect(
  action: ReturnType<typeof addEvent>,
): Generator<
  StrictEffect,
  void,
  ReturnType<typeof selectEventsAndSubscription>
> {
  const { eventsWithMetadata, existingSubscription } = yield select(
    selectEventsAndSubscription,
  );

  const authorPublicKeys = eventsWithMetadata.reduce<string[]>(
    (authorPublicKeys, eventWithMetadata) => {
      const authorPublicKey = getAuthorFromEvent(eventWithMetadata.event);
      if (
        typeof authorPublicKey !== "undefined" &&
        !authorPublicKeys.includes(authorPublicKey)
      ) {
        return authorPublicKeys.concat(authorPublicKey);
      }
      return authorPublicKeys;
    },
    [],
  );

  if (authorPublicKeys.length === 0) {
    yield put(stopSubscription(AUTHOR_SUBSCRIPTION_ID));
  } else {
    const existingAuthorQuery = existingSubscription?.query?.[0]?.authors;
    if (
      typeof existingAuthorQuery !== "undefined" &&
      existingAuthorQuery.length > 0
    ) {
      const isEveryAuthorAlreadyIncludedInTheSubscription =
        authorPublicKeys.every((authorPublicKey) =>
          existingAuthorQuery.includes(authorPublicKey),
        );

      if (isEveryAuthorAlreadyIncludedInTheSubscription) {
        return;
      }
    }
    yield put(
      startSubscription({
        filters: [
          {
            kinds: [TRUSTROOTS_PROFILE_KIND],
            authors: authorPublicKeys,
          },
        ],
        id: AUTHOR_SUBSCRIPTION_ID,
      }),
    );
  }
}

function* subscribeToUserProfilesSaga() {
  yield debounce(5e3, addEvent, subscribeToUserProfilesSagaEffect);
}

export default function* subscriptionSaga() {
  yield all([
    startSubscriptionSaga(),
    stopSubscriptionSaga(),
    subscribeToUserProfilesSaga(),
  ]);
}
