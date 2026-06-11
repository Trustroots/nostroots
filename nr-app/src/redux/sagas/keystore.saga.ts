import {
  getPublicKeyHexFromSecureStorage,
  setPrivateKeyInSecureStorage,
} from "@/nostr/keystore.nostr";
import { createPromiseActionSaga } from "@/utils/saga.utils";
import { all, call, put } from "redux-saga/effects";
import { clearKeystoreState, setPublicKeyHex } from "../slices/keystore.slice";

function* hydrateKeystoreFromSecureStorage() {
  const stored: Awaited<ReturnType<typeof getPublicKeyHexFromSecureStorage>> =
    yield call(getPublicKeyHexFromSecureStorage);

  if (!stored) {
    yield put(clearKeystoreState());
    return;
  }

  yield put(
    setPublicKeyHex({
      hasMnemonic: stored.hasMnemonicInSecureStorage,
      publicKeyHex: stored.publicKeyHex,
    }),
  );
}

export const [setPrivateKeyPromiseAction, setPrivateKeySaga] =
  createPromiseActionSaga<
    { mnemonic: string } | { privateKeyHex: string },
    void
  >({
    actionTypePrefix: "keystore/setPrivateKey",
    *effect(action) {
      const hasMnemonic = "mnemonic" in action.payload;

      const publicKeyHex: Awaited<
        ReturnType<typeof setPrivateKeyInSecureStorage>
      > = yield call(setPrivateKeyInSecureStorage, action.payload);

      yield put(
        setPublicKeyHex({
          hasMnemonic,
          publicKeyHex,
        }),
      );
    },
  });

export function* keystoreSaga() {
  yield call(hydrateKeystoreFromSecureStorage);
  yield all([setPrivateKeySaga()]);
}
