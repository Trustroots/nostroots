import { hexToBytes } from "@noble/hashes/utils";
import { configureStore } from "@reduxjs/toolkit";
import { getPublicKey } from "nostr-tools";
import { accountFromSeedWords } from "nip06";
import createSagaMiddleware from "redux-saga";
import { promiseMiddleware } from "redux-saga-promise-actions";

import {
  SECURE_STORE_PRIVATE_KEY_HEX_KEY,
  SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
} from "@/constants";
import { keystoreSlice } from "@/redux/slices/keystore.slice";
import { seedSecureStoreMock } from "@/test/secureStoreMock";
import { keystoreSaga, setPrivateKeyPromiseAction } from "./keystore.saga";

const mnemonic =
  "romance slim fame pipe puzzle priority actress must impulse tape super bike";

function startKeystoreSaga() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { keystore: keystoreSlice.reducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }).concat(
        promiseMiddleware,
        sagaMiddleware,
      ),
  });
  const task = sagaMiddleware.run(keystoreSaga);
  return { store, task };
}

async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe("keystore.saga", () => {
  it("marks the keystore loaded and empty when nothing is stored", async () => {
    const { store, task } = startKeystoreSaga();
    await flushPromises();

    expect(store.getState().keystore).toMatchObject({
      hasPrivateKeyHexInSecureStorage: false,
      isLoaded: true,
    });
    task.cancel();
  });

  it("hydrates the public key from a stored mnemonic", async () => {
    const account = accountFromSeedWords({ mnemonic });
    seedSecureStoreMock({
      [SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC]: mnemonic,
      [SECURE_STORE_PRIVATE_KEY_HEX_KEY]: account.privateKey.hex,
    });

    const { store, task } = startKeystoreSaga();
    await flushPromises();

    expect(store.getState().keystore).toMatchObject({
      hasPrivateKeyHexInSecureStorage: true,
      hasPrivateKeyMnemonicInSecureStorage: true,
      publicKeyHex: account.publicKey.hex,
    });
    task.cancel();
  });

  it("stores a private key and resolves the promise action", async () => {
    const privateKeyHex = "1".repeat(64);
    const { store, task } = startKeystoreSaga();
    await flushPromises();

    await store.dispatch(setPrivateKeyPromiseAction.request({ privateKeyHex }));

    expect(store.getState().keystore).toMatchObject({
      hasPrivateKeyHexInSecureStorage: true,
      hasPrivateKeyMnemonicInSecureStorage: false,
      publicKeyHex: getPublicKey(hexToBytes(privateKeyHex)),
    });
    task.cancel();
  });

  it("rejects the promise action when the key can't be stored", async () => {
    const { store, task } = startKeystoreSaga();
    await flushPromises();

    await expect(
      store.dispatch(
        setPrivateKeyPromiseAction.request({ mnemonic: "not a mnemonic" }),
      ),
    ).rejects.toThrow();
    expect(store.getState().keystore.publicKeyHex).toBeUndefined();
    task.cancel();
  });
});
