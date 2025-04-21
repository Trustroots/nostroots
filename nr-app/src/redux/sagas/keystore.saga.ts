import { setPrivateKeyMnemonic } from "@/nostr/keystore.nostr";
import { createPromiseActionSaga } from "@/utils/saga.utils";
import { all, call, put } from "redux-saga/effects";
import { setPrivateKey } from "../actions/keystore.actions";
import { setPublicKeyHex } from "../slices/keystore.slice";

export function* setPrivateKeySagaEffect(
  action: ReturnType<typeof setPrivateKey>,
) {
  try {
    yield call(setPrivateKeyMnemonic, action.payload);
  } catch (error) {
    console.error("keystore setPrivateKeySagaEffect error", error);
    throw error;
  }
}

export const [setPrivateKeyMnemonicPromiseAction, setPrivateKeySaga] =
  createPromiseActionSaga<string, void>({
    actionTypePrefix: "keystore/setPrivateKey",
    *effect(action) {
      try {
        const account: Awaited<ReturnType<typeof setPrivateKeyMnemonic>> =
          yield call(setPrivateKeyMnemonic, action.payload);

        yield put(setPublicKeyHex(account.publicKey.hex));
      } catch (error) {
        console.error("keystore setPrivateKeyMnemonic error", error);
        throw error;
      }
    },
  });

export function* keystoreSaga() {
  yield all([setPrivateKeySaga()]);
}
