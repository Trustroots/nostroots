import {
  clearKeystoreState,
  keystoreSelectors,
  keystoreSlice,
  setKeystoreHydrated,
  setPublicKeyHex,
} from "./keystore.slice";
import { TEST_PUBKEY } from "@/test/fixtures";

describe("keystoreSlice", () => {
  it("stores public key state after a key is loaded", () => {
    const state = keystoreSlice.reducer(
      undefined,
      setPublicKeyHex({
        publicKeyHex: TEST_PUBKEY,
        hasMnemonic: true,
      }),
    );

    expect(state.isLoaded).toBe(true);
    expect(state.hasPrivateKeyHexInSecureStorage).toBe(true);
    expect(state.hasPrivateKeyMnemonicInSecureStorage).toBe(true);
    expect(state.publicKeyHex).toBe(TEST_PUBKEY);
    expect(state.publicKeyNpub).toMatch(/^npub/);
  });

  it("clears private key flags while keeping hydration complete", () => {
    const loaded = keystoreSlice.reducer(
      undefined,
      setPublicKeyHex({
        publicKeyHex: TEST_PUBKEY,
        hasMnemonic: false,
      }),
    );
    const cleared = keystoreSlice.reducer(loaded, clearKeystoreState());

    expect(
      keystoreSelectors.selectHasPrivateKeyInSecureStorage({
        keystore: cleared,
      }),
    ).toBe(false);
    expect(
      keystoreSelectors.selectIsKeystoreLoaded({ keystore: cleared }),
    ).toBe(true);
  });

  it("marks the keystore as hydrated even without a key", () => {
    const state = keystoreSlice.reducer(undefined, setKeystoreHydrated());

    expect(state.isLoaded).toBe(true);
    expect(state.hasPrivateKeyHexInSecureStorage).toBe(false);
  });
});
