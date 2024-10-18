import { all } from "redux-saga/effects";
import mapSaga from "./map.saga";
import subscriptionSaga from "./subscriptions.saga";

export default function* rootSaga() {
  yield all([mapSaga(), subscriptionSaga()]);
}
