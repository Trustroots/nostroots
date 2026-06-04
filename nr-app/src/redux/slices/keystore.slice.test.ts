import { nip19 } from "nostr-tools";

import {
  keystoreSelectors,
  keystoreSlice,
  setPublicKeyHex,
} from "./keystore.slice";

describe("keystore.slice", () => {
  it("stores public key information after setting a key", () => {
    const publicKeyHex = "1".repeat(64);
    const state = keystoreSlice.reducer(
      keystoreSlice.getInitialState(),
      setPublicKeyHex({ hasMnemonic: true, publicKeyHex }),
    );

    expect(
      keystoreSelectors.selectHasPrivateKeyHexInSecureStorage.unwrapped(state),
    ).toBe(true);
    expect(
      keystoreSelectors.selectHasPrivateKeyMnemonicInSecureStorage.unwrapped(
        state,
      ),
    ).toBe(true);
    expect(keystoreSelectors.selectPublicKeyHex.unwrapped(state)).toBe(
      publicKeyHex,
    );
    expect(keystoreSelectors.selectPublicKeyNpub.unwrapped(state)).toBe(
      nip19.npubEncode(publicKeyHex),
    );
  });

  it("defaults to no private key in storage", () => {
    const state = keystoreSlice.getInitialState();

    expect(
      keystoreSelectors.selectHasPrivateKeyInSecureStorage.unwrapped(state),
    ).toBe(false);
    expect(
      keystoreSelectors.selectPublicKeyHex.unwrapped(state),
    ).toBeUndefined();
  });
});
