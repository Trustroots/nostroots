import { PayloadAction } from "@reduxjs/toolkit";
import { all, put, takeEvery } from "redux-saga/effects";
import { setMapSubscriptionIsUpdating } from "../slices/map.slice";
import { setVisiblePlusCodes } from "../actions/map.actions";

function* updateDataForMapSagaEffect(action: PayloadAction<string[]>) {
  try {
    // Setup a subscription
    const visiblePlusCodes = action.payload;
    console.log("#tJ7hyp Got visible plus codes", visiblePlusCodes);
    // Write the state to redux
    put(setMapSubscriptionIsUpdating(true));
    // Call a subscription
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    yield put({ type: "fail", action: message });
  }
}

export function* updateDataForMapSaga() {
  yield takeEvery(setVisiblePlusCodes, updateDataForMapSagaEffect);
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
