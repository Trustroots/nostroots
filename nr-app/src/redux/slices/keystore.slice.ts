import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { nip19 } from "nostr-tools";

type KeystoreState = {
  hasPrivateKeyInSecureStorage: boolean;
  publicKeyNpub?: `npub${string}`;
  publicKeyHex?: string;
};

const initialState: KeystoreState = {
  hasPrivateKeyInSecureStorage: false,
};

export const keystoreSlice = createSlice({
  name: "keystore",
  initialState,
  reducers: {
    setPublicKeyHex: (state, action: PayloadAction<string>) => {
      state.hasPrivateKeyInSecureStorage = true;
      state.publicKeyHex = action.payload;
      state.publicKeyNpub = nip19.npubEncode(action.payload);
    },
  },
  selectors: {
    selectHasPrivateKeyInSecureStorage: (state) =>
      state.hasPrivateKeyInSecureStorage,
  },
});

export const { setPublicKeyHex } = keystoreSlice.actions;

export const keystoreSelectors = keystoreSlice.selectors;
