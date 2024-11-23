import { setPrivateKeyMnemonic } from "@/nostr/keystore.nostr";
import { createPromiseActionSaga } from "@/utils/saga.utils";
import { all, call, put } from "redux-saga/effects";
import { setPrivateKey } from "../actions/keystore.actions";
import { setPublicKeyHex } from "../slices/keystore.slice";

export function* setPrivateKeySagaEffect(
  action: ReturnType<typeof setPrivateKey>,
) {
  yield call(setPrivateKeyMnemonic, action.payload);
}

export const [setPrivateKeyMnemonicPromiseAction, setPrivateKeySaga] =
  createPromiseActionSaga<string, void>({
    actionTypePrefix: "keystore/setPrivateKey",
    *effect(action) {
      const account: Awaited<ReturnType<typeof setPrivateKeyMnemonic>> =
        yield call(setPrivateKeyMnemonic, action.payload);

      yield put(setPublicKeyHex(account.publicKey.hex));
    },
  });

export function* keystoreSaga() {
  yield all([setPrivateKeySaga()]);
}
