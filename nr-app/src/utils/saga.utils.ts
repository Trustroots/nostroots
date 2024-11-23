import { PayloadAction } from "@reduxjs/toolkit";
import {
  createPromiseAction,
  rejectPromiseAction,
  resolvePromiseAction,
} from "redux-saga-promise-actions";
import { call, put, takeEvery } from "redux-saga/effects";
import { getSerializableError, SerializableError } from "./error.utils";

export function createPromiseActionSaga<PayloadType, ResolveType>({
  actionTypePrefix,
  effect,
}: {
  actionTypePrefix: string;
  effect: (
    action: PayloadAction<PayloadType>,
  ) => Generator<any, ResolveType, any>;
}) {
  const promiseAction = createPromiseAction(
    `${actionTypePrefix}/request`,
    `${actionTypePrefix}/success`,
    `${actionTypePrefix}/failure`,
  )<PayloadType, ResolveType, SerializableError>();

  const sagaEffect = function* (
    action: ReturnType<typeof promiseAction.request>,
  ) {
    try {
      const result: ResolveType = yield call(effect, action);

      try {
        yield put(promiseAction.success(result));
        resolvePromiseAction(action, result);
      } catch (resolveError) {
        console.error("#OKwHTw resolving promise action failed", resolveError);
      }
    } catch (error) {
      try {
        const serializableError = getSerializableError(error);
        yield put(promiseAction.failure(serializableError));
        rejectPromiseAction(action, error);
      } catch (rejectError) {
        console.error("#jOKR3b rejecting promise action failed", rejectError);
      }
    }
  };

  const saga = function* () {
    yield takeEvery(promiseAction.request, sagaEffect);
  };

  return [promiseAction, saga] as [typeof promiseAction, typeof saga];
}
