import { setPrivateKeyMnemonic } from "@/nostr/keystore.nostr";
import { createPromiseActionSaga } from "@/utils/saga.utils";
import { all, call } from "redux-saga/effects";
import { setPrivateKey } from "../actions/keystore.actions";

export function* setPrivateKeySagaEffect(
  action: ReturnType<typeof setPrivateKey>,
) {
  yield call(setPrivateKeyMnemonic, action.payload);
}

export const [setPrivateKeyPromiseAction, setPrivateKeySaga] =
  createPromiseActionSaga<string, void>({
    actionTypePrefix: "keystore/setPrivateKey",
    *effect(action) {
      yield call(setPrivateKeyMnemonic, action.payload);
    },
  });

export function* keystoreSaga() {
  yield all([setPrivateKeySaga()]);
}
