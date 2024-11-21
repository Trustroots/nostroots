import { DEV_PUBKEY, MAP_LAYER_KEY, MAP_LAYERS } from "@/common/constants";
import { PayloadAction } from "@reduxjs/toolkit";
import { Filter } from "nostr-tools";
import { all, Effect, put, select, throttle } from "redux-saga/effects";
import { setVisiblePlusCodes } from "../actions/map.actions";
import { startSubscription } from "../actions/subscription.actions";
import {
  mapSelectors,
  setMapSubscriptionIsUpdating,
} from "../slices/map.slice";

function createMapFilters(
  visiblePlusCodes: string[],
  enabledLayerKeys: MAP_LAYER_KEY[],
): Filter[] {
  const baseFilter = {
    kinds: [30398],
    authors: [DEV_PUBKEY],
    "#L": ["open-location-code-prefix"],
    "#l": visiblePlusCodes,
  };

  const layerFilters = enabledLayerKeys.map((layer) => {
    const layerConfig = MAP_LAYERS[layer];
    return {
      kinds: [layerConfig.kind],
      authors: [layerConfig.pubKey],
      "#L": ["open-location-code-prefix"],
      "#l": visiblePlusCodes,
    };
  });

  const filters = [baseFilter, ...layerFilters];

  return filters;
}

function* updateDataForMapSagaEffect(
  action: PayloadAction<string[]>,
): Generator<
  Effect,
  void,
  ReturnType<typeof mapSelectors.selectEnabledLayerKeys>
> {
  try {
    // TODO Debounce map updates

    // Setup a subscription
    const visiblePlusCodes = action.payload;

    const enabledLayers = yield select(mapSelectors.selectEnabledLayerKeys);

    const filters = createMapFilters(visiblePlusCodes, enabledLayers);

    // Write the state to redux
    yield put(setMapSubscriptionIsUpdating(true));
    // Call a subscription
    yield put(
      startSubscription({
        // TODO Write helper to create filter
        filters,
        id: "mapVisiblePlusCodesSubscription",
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown-4HHVVD";
    yield put({ type: "fail", action: message });
  }
}

export function* updateDataForMapSaga() {
  yield throttle(1000, setVisiblePlusCodes, updateDataForMapSagaEffect);
}

export default function* mapSaga() {
  yield all([updateDataForMapSaga()]);
}

/**
 * - Dispatch an action to set the target plus codes
 * - Call the API to start / update a query for those codes
 * - Wait until the first EOSE event has arrived and update a `isLoading` to `false`
 *   - How do we get that EOSE event?
 *   - We could potentially listen for actions...
 *   - Or maybe subscribe to the store and watch for a state change
 *   - Or store the filter for the current map view in redux
 *     - Then feed the EOSE into that filter tracker
 *     - Well, maybe store the subscription ID for the map filter
 *     - Then it can be extracted like `store.subscriptions[store.map.subscriptionId].isLoading`
 */
