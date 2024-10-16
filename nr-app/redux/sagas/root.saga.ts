import { all } from "redux-saga/effects";

function* helloSaga() {
  console.log("#W0W1gS Hello from the hello saga");
}

export default function* rootSaga() {
  yield all([helloSaga()]);
}
