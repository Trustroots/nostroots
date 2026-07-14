import { all } from "redux-saga/effects";
import { keystoreSaga } from "./keystore.saga";
import mapSaga from "./map.saga";
import metricsSaga from "./metrics.saga";
import notificationsSaga from "./notifications.saga";
import publishSaga from "./publish.saga";
import subscriptionSaga from "./subscriptions.saga";
import serverMessagesSaga from "./serverMessages.saga";
import { eventsSaga } from "./events.saga";
import { profilesSaga } from "./profiles.saga";

export default function* rootSaga() {
  yield all([
    eventsSaga(),
    keystoreSaga(),
    mapSaga(),
    metricsSaga(),
    notificationsSaga(),
    profilesSaga(),
    publishSaga(),
    subscriptionSaga(),
    serverMessagesSaga(),
  ]);
}
