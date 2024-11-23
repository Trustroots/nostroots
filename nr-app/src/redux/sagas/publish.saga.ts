import { signEventTemplate } from "@/nostr/keystore.nostr";
import { publishVerifiedEventToRelay } from "@/nostr/publish.nostr";
import { getSerializableError } from "@/utils/error.utils";
import { A } from "@mobily/ts-belt";
import {
  rejectPromiseAction,
  resolvePromiseAction,
} from "redux-saga-promise-actions";
import { all, call, put, select, takeEvery } from "redux-saga/effects";
import { publishEventPromiseAction } from "../actions/publish.actions";
import { relaySelectors } from "../slices/relays.slice";

export function* publishSagaEffect(
  action: ReturnType<typeof publishEventPromiseAction.request>,
): Generator<any, void, any> {
  try {
    const { eventTemplate } = action.payload;

    const relayUrls: ReturnType<typeof relaySelectors.getActiveRelayUrls> =
      yield select(relaySelectors.getActiveRelayUrls);

    const event: Awaited<ReturnType<typeof signEventTemplate>> = yield call(
      signEventTemplate,
      eventTemplate,
    );

    const results: Awaited<ReturnType<typeof publishVerifiedEventToRelay>>[] =
      yield all(
        relayUrls.map((relayUrl) =>
          call(publishVerifiedEventToRelay, event, relayUrl),
        ),
      );

    const resultPairs = A.zip(relayUrls, results);

    const output = Object.fromEntries(resultPairs);

    yield put(publishEventPromiseAction.success(output));
    resolvePromiseAction(action, output);
  } catch (error) {
    const serializableError = getSerializableError(error);
    yield put(publishEventPromiseAction.failure(serializableError));
    rejectPromiseAction(action, serializableError);
  }
}

export function* publishEventSaga() {
  yield takeEvery(publishEventPromiseAction.request, publishSagaEffect);
}

export default function* publishSaga() {
  yield all([publishEventSaga()]);
}
