import * as SecureStore from "expo-secure-store";
import { nip19 } from "nostr-tools";

import {
  clearPrivateKey,
  generatePrivateKey,
  getPrivateKeyMnemonicFromSecureStorage,
  getPublicKeyHexFromSecureStorage,
  importPrivateKey,
  parseKeyInput,
} from "@/nostr/keystore";

const validSecretHex = "0".repeat(63) + "1";
const validMnemonic =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

beforeEach(() => {
  (SecureStore as unknown as { __reset: () => void }).__reset();
});

describe("keystore", () => {
  it("parses accepted key inputs and rejects public keys", () => {
    const nsec = nip19.nsecEncode(Uint8Array.from({ length: 32 }, (_, i) => i + 1));

    expect(() => parseKeyInput("")).toThrow("Enter an nsec");
    expect(() => parseKeyInput("npub1whatever")).toThrow("You pasted an npub");
    expect(() => parseKeyInput("nsec1bad")).toThrow("That nsec does not look valid");
    expect(parseKeyInput(nsec)).toMatchObject({ type: "nsec" });
    expect(parseKeyInput(validSecretHex)).toEqual({
      type: "hex",
      privateKeyHex: validSecretHex,
    });
    expect(() => parseKeyInput("z".repeat(64))).toThrow("invalid characters");
    expect(parseKeyInput(validMnemonic)).toMatchObject({
      type: "mnemonic",
      mnemonic: validMnemonic,
    });
    expect(() => parseKeyInput("abandon abandon abandon")).toThrow(
      "recovery phrase is not valid",
    );
  });

  it("imports and clears a key", async () => {
    await importPrivateKey(validMnemonic);

    await expect(getPublicKeyHexFromSecureStorage()).resolves.toHaveLength(64);
    await expect(getPrivateKeyMnemonicFromSecureStorage()).resolves.toBe(
      validMnemonic,
    );

    await clearPrivateKey();

    await expect(getPublicKeyHexFromSecureStorage()).rejects.toThrow(
      "No Nostroots Browser key",
    );
  });

  it("generates mnemonic-backed keys", async () => {
    const generated = await generatePrivateKey();

    expect(generated.mnemonic.split(" ")).toHaveLength(12);
    expect(parseKeyInput(generated.mnemonic)).toMatchObject({
      type: "mnemonic",
      mnemonic: generated.mnemonic,
    });
    await expect(getPrivateKeyMnemonicFromSecureStorage()).resolves.toBe(
      generated.mnemonic,
    );
  });
});
