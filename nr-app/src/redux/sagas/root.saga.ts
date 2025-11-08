import { all } from "redux-saga/effects";
import { keystoreSaga } from "./keystore.saga";
import mapSaga from "./map.saga";
import notificationsSaga from "./notifications.saga";
import publishSaga from "./publish.saga";
import subscriptionSaga from "./subscriptions.saga";
import { eventsSaga } from "./events.saga";

export default function* rootSaga() {
  yield all([
    eventsSaga(),
    keystoreSaga(),
    mapSaga(),
    notificationsSaga(),
    publishSaga(),
    subscriptionSaga(),
  ]);
}
