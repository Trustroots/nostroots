import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { nip19 } from "nostr-tools";

type KeystoreState = {
  hasPrivateKeyHexInSecureStorage: boolean;
  hasPrivateKeyMnemonicInSecureStorage: boolean;
  publicKeyNpub?: `npub${string}`;
  publicKeyHex?: string;
  isLoaded: boolean;
};

const initialState: KeystoreState = {
  hasPrivateKeyHexInSecureStorage: false,
  hasPrivateKeyMnemonicInSecureStorage: false,
  isLoaded: false,
};

export const keystoreSlice = createSlice({
  name: "keystore",
  initialState,
  reducers: {
    setPublicKeyHex: (
      state,
      action: PayloadAction<{ publicKeyHex: string; hasMnemonic: boolean }>,
    ) => {
      state.hasPrivateKeyHexInSecureStorage = true;
      state.hasPrivateKeyMnemonicInSecureStorage = action.payload.hasMnemonic;
      state.publicKeyHex = action.payload.publicKeyHex;
      state.publicKeyNpub = nip19.npubEncode(action.payload.publicKeyHex);
    },
  },
  selectors: {
    selectHasPrivateKeyInSecureStorage: (state) =>
      state.hasPrivateKeyHexInSecureStorage,
    selectHasPrivateKeyHexInSecureStorage: (state) =>
      state.hasPrivateKeyHexInSecureStorage,
    selectHasPrivateKeyMnemonicInSecureStorage: (state) =>
      state.hasPrivateKeyMnemonicInSecureStorage,
    selectPublicKeyHex: (state) => {
      // console.log("seelct public key hex", state);
      return state.publicKeyHex;
    },
    selectPublicKeyNpub: (state) => {
      // console.log("seelct public key npub", state);
      return state.publicKeyNpub;
    },
  },
});

export const { setPublicKeyHex } = keystoreSlice.actions;

export const keystoreSelectors = keystoreSlice.selectors;
