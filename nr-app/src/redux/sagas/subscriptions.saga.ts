import { takeEvery } from "redux-saga/effects";

function* subscriptionSagaWorker() {
  // Do something
}

export default function* subscriptionSaga() {
  yield takeEvery("some_action", subscriptionSagaWorker);
}
