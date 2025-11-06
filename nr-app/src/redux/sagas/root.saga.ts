import { all } from "redux-saga/effects";
import mapSaga from "./map.saga";
import subscriptionSaga from "./subscriptions.saga";
import publishSaga from "./publish.saga";
import { keystoreSaga } from "./keystore.saga";
import notificationsSaga from "./notifications.saga";
import nostrSaga from "./nostr.saga";

export default function* rootSaga() {
  yield all([
    keystoreSaga(),
    mapSaga(),
    notificationsSaga(),
    nostrSaga(),
    publishSaga(),
    subscriptionSaga(),
  ]);
}
