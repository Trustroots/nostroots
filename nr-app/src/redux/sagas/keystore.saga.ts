import { setPrivateKeyInSecureStorage } from "@/nostr/keystore.nostr";
import { createPromiseActionSaga } from "@/utils/saga.utils";
import { all, call, put } from "redux-saga/effects";
import { setPublicKeyHex } from "../slices/keystore.slice";

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
  yield all([setPrivateKeySaga()]);
}
