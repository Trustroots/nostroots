import { all } from "redux-saga/effects";
import mapSaga from "./map.saga";
import subscriptionSaga from "./subscriptions.saga";

function* helloSaga() {
  console.log("#W0W1gS Hello from the hello saga");
}

export default function* rootSaga() {
  yield all([helloSaga(), mapSaga(), subscriptionSaga()]);
}
