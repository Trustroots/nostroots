import {
  SECURE_STORE_PRIVATE_KEY_HEX_KEY,
  SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
} from "@/constants";
import {
  resetSecureStoreMock,
  seedSecureStoreMock,
} from "@/test/secureStoreMock";
import { hexToBytes } from "@noble/hashes/utils";
import { accountFromSeedWords } from "nip06";
import * as SecureStore from "expo-secure-store";
import {
  derivePublicKeyHexFromMnemonic,
  getHasPrivateKeyHexInSecureStorage,
  getHasPrivateKeyInSecureStorage,
  getHasPrivateKeyMnemonicInSecureStorage,
  getPrivateKeyBytesFromSecureStorage,
  getPrivateKeyHexFromSecureStorage,
  getPrivateKeyMnemonicFromSecureStorage,
  getPublicKeyHexFromSecureStorage,
  getPublicKeyHexStringFromSecureStorage,
  nip04Decrypt,
  nip04Encrypt,
  nip44Decrypt,
  nip44Encrypt,
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
    await expect(getPublicKeyHexFromSecureStorage()).resolves.toBeUndefined();
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
    await expect(getPrivateKeyBytesFromSecureStorage()).resolves.toEqual(
      hexToBytes(account.privateKey.hex),
    );
    await expect(getPublicKeyHexStringFromSecureStorage()).resolves.toBe(
      account.publicKey.hex,
    );
    await expect(getHasPrivateKeyHexInSecureStorage()).resolves.toBe(true);
    await expect(getHasPrivateKeyInSecureStorage()).resolves.toBe(true);
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

  it("uses the signing key as canonical if a stale mnemonic remains", async () => {
    const account = accountFromSeedWords({ mnemonic });
    seedSecureStoreMock({
      [SECURE_STORE_PRIVATE_KEY_HEX_KEY]: account.privateKey.hex,
      [SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC]:
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    });

    await expect(getPublicKeyHexFromSecureStorage()).resolves.toEqual({
      hasMnemonicInSecureStorage: false,
      publicKeyHex: account.publicKey.hex,
    });
    await expect(getHasPrivateKeyMnemonicInSecureStorage()).resolves.toBe(
      false,
    );
  });

  it("rolls back both values if replacing a mnemonic-backed key fails", async () => {
    const oldAccount = accountFromSeedWords({ mnemonic });
    seedSecureStoreMock({
      [SECURE_STORE_PRIVATE_KEY_HEX_KEY]: oldAccount.privateKey.hex,
      [SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC]: mnemonic,
    });
    const replacement =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const setItemAsync = SecureStore.setItemAsync as jest.MockedFunction<
      typeof SecureStore.setItemAsync
    >;
    setItemAsync
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error("full"));

    await expect(
      setPrivateKeyInSecureStorage({ mnemonic: replacement }),
    ).rejects.toThrow("full");
    await expect(getPrivateKeyHexFromSecureStorage()).resolves.toBe(
      oldAccount.privateKey.hex,
    );
    await expect(getPrivateKeyMnemonicFromSecureStorage()).resolves.toBe(
      mnemonic,
    );
  });

  it("removes partially written values when an initial save fails", async () => {
    const setItemAsync = SecureStore.setItemAsync as jest.MockedFunction<
      typeof SecureStore.setItemAsync
    >;
    setItemAsync
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error("full"));

    await expect(setPrivateKeyInSecureStorage({ mnemonic })).rejects.toThrow(
      "full",
    );
    await expect(getHasPrivateKeyInSecureStorage()).resolves.toBe(false);
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

  it("encrypts and decrypts NIP-04 and NIP-44 messages", async () => {
    const account = accountFromSeedWords({ mnemonic });
    await setPrivateKeyInSecureStorage({ mnemonic });
    const peerPubkey = account.publicKey.hex;

    const nip44Ciphertext = await nip44Encrypt(peerPubkey, "nip44 secret");
    await expect(nip44Decrypt(peerPubkey, nip44Ciphertext)).resolves.toBe(
      "nip44 secret",
    );

    const nip04Ciphertext = await nip04Encrypt(peerPubkey, "nip04 secret");
    await expect(nip04Decrypt(peerPubkey, nip04Ciphertext)).resolves.toBe(
      "nip04 secret",
    );
  });

  it("rejects invalid peer keys for every encryption operation", async () => {
    await expect(nip44Encrypt("invalid", "plaintext")).rejects.toThrow(
      "Invalid peer public key.",
    );
    await expect(nip44Decrypt("invalid", "ciphertext")).rejects.toThrow(
      "Invalid peer public key.",
    );
    await expect(nip04Encrypt("invalid", "plaintext")).rejects.toThrow(
      "Invalid peer public key.",
    );
    await expect(nip04Decrypt("invalid", "ciphertext")).rejects.toThrow(
      "Invalid peer public key.",
    );
  });
});
