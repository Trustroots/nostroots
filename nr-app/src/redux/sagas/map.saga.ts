import {
  filterForMapLayerConfig,
  trustrootsMapFilterForPlusCodePrefixes,
} from "@/common/utils";
import { MAP_LAYER_KEY, MAP_LAYERS } from "@trustroots/nr-common";
import { createSelector } from "@reduxjs/toolkit";
import { Filter } from "nostr-tools";
import { AnyAction } from "redux-saga";
import {
  all,
  Effect,
  put,
  select,
  takeEvery,
  throttle,
} from "redux-saga/effects";
import { setVisiblePlusCodes } from "../actions/map.actions";
import { startSubscription } from "../actions/subscription.actions";
import {
  MAP_SUBSCRIPTION_ID,
  mapActions,
  mapSelectors,
} from "../slices/map.slice";

function createMapFilters(
  visiblePlusCodes: string[],
  enabledLayerKeys: MAP_LAYER_KEY[],
): Filter[] {
  const baseFilter = trustrootsMapFilterForPlusCodePrefixes(visiblePlusCodes);

  const layerFilters = enabledLayerKeys.map((layer) => {
    const layerConfig = MAP_LAYERS[layer];
    const filter = filterForMapLayerConfig(layerConfig);
    return filter;
  });

  const filters = [baseFilter, ...layerFilters];

  return filters;
}

const mapSagaSelector = createSelector(
  [mapSelectors.selectVisiblePlusCodes, mapSelectors.selectEnabledLayerKeys],
  (visiblePlusCodes, enabledLayerKeys) => ({
    visiblePlusCodes,
    enabledLayerKeys,
  }),
);

function* updateDataForMapSagaEffect(
  action: AnyAction,
): Generator<Effect, void, ReturnType<typeof mapSagaSelector>> {
  try {
    // TODO Debounce map updates

    // Setup a subscription
    const { visiblePlusCodes, enabledLayerKeys } =
      yield select(mapSagaSelector);

    const filters = createMapFilters(visiblePlusCodes, enabledLayerKeys);

    // Write the state to redux
    yield put(mapActions.setMapSubscriptionIsUpdating(true));
    // Call a subscription
    yield put(
      startSubscription({
        // TODO Write helper to create filter
        filters,
        id: MAP_SUBSCRIPTION_ID,
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

export function* updateDataForMapFromLayerToggleSaga() {
  yield takeEvery(mapActions.toggleLayer, updateDataForMapSagaEffect);
}

export default function* mapSaga() {
  yield all([updateDataForMapSaga(), updateDataForMapFromLayerToggleSaga()]);
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
