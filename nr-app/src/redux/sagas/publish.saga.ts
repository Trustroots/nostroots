import { signEventTemplate } from "@/nostr/keystore.nostr";
import { publishVerifiedEventToRelay } from "@/nostr/publish.nostr";
import { getSerializableError } from "@/utils/error.utils";
import { A } from "@mobily/ts-belt";
import {
  rejectPromiseAction,
  resolvePromiseAction,
} from "redux-saga-promise-actions";
import { all, call, put, select, takeEvery } from "redux-saga/effects";
import {
  publishEventPromiseAction,
  publishEventTemplatePromiseAction,
} from "../actions/publish.actions";
import { relaySelectors } from "../slices/relays.slice";

export function* publishEventSagaEffect(
  action: ReturnType<typeof publishEventPromiseAction.request>,
): Generator<any, void, any> {
  try {
    const { event } = action.payload;
    const { id } = event;

    const relayUrls: ReturnType<typeof relaySelectors.getActiveRelayUrls> =
      yield select(relaySelectors.getActiveRelayUrls);

    const results: Awaited<ReturnType<typeof publishVerifiedEventToRelay>>[] =
      yield all(
        relayUrls.map((relayUrl) =>
          call(publishVerifiedEventToRelay, event, relayUrl),
        ),
      );

    const resultPairs = A.zip(relayUrls, results);
    const relayResponses = Object.fromEntries(resultPairs);
    const output = { id, relayResponses };

    yield put(publishEventPromiseAction.success(output));
    resolvePromiseAction(action, output);
  } catch (error) {
    const serializableError = getSerializableError(error);
    yield put(publishEventPromiseAction.failure(serializableError));
    rejectPromiseAction(action, serializableError);
  }
}

export function* publishEventSaga() {
  yield takeEvery(publishEventPromiseAction.request, publishEventSagaEffect);
}

export function* publishEventTemplateSagaEffect(
  action: ReturnType<typeof publishEventTemplatePromiseAction.request>,
): Generator<any, void, Awaited<ReturnType<typeof signEventTemplate>>> {
  const { eventTemplate } = action.payload;

  try {
    const event = yield call(signEventTemplate, eventTemplate);

    yield put(publishEventPromiseAction.request({ event }));

    yield put(publishEventTemplatePromiseAction.success({ event }));
  } catch (error) {
    const serializableError = getSerializableError(error);
    yield put(publishEventTemplatePromiseAction.failure(serializableError));
  }
}

export function* publishEventTemplateSaga() {
  yield takeEvery(
    publishEventTemplatePromiseAction.request,
    publishEventTemplateSagaEffect,
  );
}

export default function* publishSaga() {
  yield all([publishEventSaga(), publishEventTemplateSaga()]);
}
