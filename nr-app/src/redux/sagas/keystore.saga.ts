import { setPrivateKeyMnemonic } from "@/nostr/keystore.nostr";
import { createPromiseActionSaga } from "@/utils/saga.utils";
import { all, call, put } from "redux-saga/effects";
import { setPrivateKey } from "../actions/keystore.actions";
import { setLoading, setPublicKeyHex } from "../slices/keystore.slice";

export function* setPrivateKeySagaEffect(
  action: ReturnType<typeof setPrivateKey>,
) {
  try {
    yield put(setLoading(true));
    yield call(setPrivateKeyMnemonic, action.payload);
    yield put(setLoading(false));
  } catch (error) {
    yield put(setLoading(false));
    throw error;
  }
}

export const [setPrivateKeyMnemonicPromiseAction, setPrivateKeySaga] =
  createPromiseActionSaga<string, void>({
    actionTypePrefix: "keystore/setPrivateKey",
    *effect(action) {
      try {
        yield put(setLoading(true));

        const account: Awaited<ReturnType<typeof setPrivateKeyMnemonic>> =
          yield call(setPrivateKeyMnemonic, action.payload);

        yield put(setPublicKeyHex(account.publicKey.hex));

        yield put(setLoading(false));
      } catch (error) {
        yield put(setLoading(false));
        throw error;
      }
    },
  });

export function* keystoreSaga() {
  yield all([setPrivateKeySaga()]);
}
