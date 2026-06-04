import {
  SECURE_STORE_PRIVATE_KEY_HEX_KEY,
  SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
} from "@/constants";
import {
  resetSecureStoreMock,
  seedSecureStoreMock,
} from "@/test/secureStoreMock";
import { accountFromSeedWords } from "nip06";
import {
  derivePublicKeyHexFromMnemonic,
  getHasPrivateKeyHexInSecureStorage,
  getHasPrivateKeyInSecureStorage,
  getHasPrivateKeyMnemonicInSecureStorage,
  getPrivateKeyHexFromSecureStorage,
  getPrivateKeyMnemonicFromSecureStorage,
  getPublicKeyHexFromSecureStorage,
  setPrivateKeyInSecureStorage,
  signEventTemplate,
} from "./keystore.nostr";

const mnemonic =
  "romance slim fame pipe puzzle priority actress must impulse tape super bike";

describe("keystore.nostr", () => {
  beforeEach(() => {
    resetSecureStoreMock();
  });

  it("reports no key when secure storage is empty", async () => {
    await expect(getHasPrivateKeyInSecureStorage()).resolves.toBe(false);
    await expect(getHasPrivateKeyHexInSecureStorage()).resolves.toBe(false);
    await expect(getHasPrivateKeyMnemonicInSecureStorage()).resolves.toBe(
      false,
    );
  });

  it("stores and retrieves mnemonic-backed keys", async () => {
    const account = accountFromSeedWords({ mnemonic });

    await expect(setPrivateKeyInSecureStorage({ mnemonic })).resolves.toBe(
      account.publicKey.hex,
    );

    await expect(getPrivateKeyMnemonicFromSecureStorage()).resolves.toBe(
      mnemonic,
    );
    await expect(getPrivateKeyHexFromSecureStorage()).resolves.toBe(
      account.privateKey.hex,
    );
    await expect(getPublicKeyHexFromSecureStorage()).resolves.toEqual({
      hasMnemonicInSecureStorage: true,
      publicKeyHex: account.publicKey.hex,
    });
  });

  it("stores private hex keys without keeping mnemonic", async () => {
    const account = accountFromSeedWords({ mnemonic });

    seedSecureStoreMock({
      [SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC]: mnemonic,
    });

    await expect(
      setPrivateKeyInSecureStorage({ privateKeyHex: account.privateKey.hex }),
    ).resolves.toBe(account.publicKey.hex);

    await expect(getPrivateKeyHexFromSecureStorage()).resolves.toBe(
      account.privateKey.hex,
    );
    await expect(getHasPrivateKeyMnemonicInSecureStorage()).resolves.toBe(
      false,
    );
  });

  it("rejects invalid stored hex keys", async () => {
    seedSecureStoreMock({
      [SECURE_STORE_PRIVATE_KEY_HEX_KEY]: "not-hex",
    });

    await expect(getPrivateKeyHexFromSecureStorage()).rejects.toThrow(
      "#1RCMGy-invalid-key-retrieved",
    );
  });

  it("derives public keys from mnemonics", () => {
    const account = accountFromSeedWords({ mnemonic });

    expect(derivePublicKeyHexFromMnemonic(mnemonic)).toBe(
      account.publicKey.hex,
    );
  });

  it("signs event templates with the stored private key", async () => {
    const account = accountFromSeedWords({ mnemonic });
    await setPrivateKeyInSecureStorage({ mnemonic });

    await expect(
      signEventTemplate({
        content: "hello",
        created_at: 1,
        kind: 1,
        tags: [],
      }),
    ).resolves.toMatchObject({
      content: "hello",
      kind: 1,
      pubkey: account.publicKey.hex,
    });
  });
});
