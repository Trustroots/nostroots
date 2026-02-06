import { all, take } from "redux-saga/effects";
import { rehydrated } from "../actions/startup.actions";
import { store } from "../store";
import { eventsActions } from "../slices/events.slice";
import { getCurrentTimestamp } from "@trustroots/nr-common";

const FLUSH_EXPIRED_EVENTS_EVERY_MILLISECONDS = 10 * 60 * 1000;

function flushExpiredEvents() {
  store.dispatch(
    eventsActions.flushExpiredEvents({
      currentTimestampSeconds: getCurrentTimestamp(),
    }),
  );
}

export function startPeriodicFlushingOfExpiredEvents() {
  flushExpiredEvents();
  setInterval(flushExpiredEvents, FLUSH_EXPIRED_EVENTS_EVERY_MILLISECONDS);
}

export function* flushExpiredEventsSaga() {
  yield take(rehydrated);
  startPeriodicFlushingOfExpiredEvents();
}

export function* eventsSaga() {
  yield all([flushExpiredEventsSaga()]);
}
