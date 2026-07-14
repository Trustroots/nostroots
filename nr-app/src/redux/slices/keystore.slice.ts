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
      state.isLoaded = true;
    },
    clearKeystoreState: (state) => {
      state.hasPrivateKeyHexInSecureStorage = false;
      state.hasPrivateKeyMnemonicInSecureStorage = false;
      state.publicKeyHex = undefined;
      state.publicKeyNpub = undefined;
      state.isLoaded = true;
    },
    setKeystoreHydrated: (state) => {
      state.isLoaded = true;
    },
  },
  selectors: {
    selectIsKeystoreLoaded: (state) => state.isLoaded,
    selectHasPrivateKeyInSecureStorage: (state) =>
      state.hasPrivateKeyHexInSecureStorage,
    selectHasPrivateKeyHexInSecureStorage: (state) =>
      state.hasPrivateKeyHexInSecureStorage,
    selectHasPrivateKeyMnemonicInSecureStorage: (state) =>
      state.hasPrivateKeyMnemonicInSecureStorage,
    selectPublicKeyHex: (state) => {
      return state.publicKeyHex;
    },
    selectPublicKeyNpub: (state) => {
      return state.publicKeyNpub;
    },
  },
});

export const { clearKeystoreState, setPublicKeyHex, setKeystoreHydrated } =
  keystoreSlice.actions;

export const keystoreSelectors = keystoreSlice.selectors;
