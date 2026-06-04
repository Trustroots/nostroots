import "react-native-get-random-values";

import * as SecureStore from "expo-secure-store";
import {
  accountFromSeedWords,
  generateSeedWords,
  getBech32PrivateKey,
  validateWords,
} from "nip06";
import { nip04, nip19, nip44 } from "nostr-tools";
import type { EventTemplate, VerifiedEvent } from "nostr-tools";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";

import {
  SECURE_STORE_PRIVATE_KEY_HEX_KEY,
  SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
} from "@/constants";
import { clearNip7Permissions } from "@/nostr/permission-store";
import { bytesToHex, hexToBytes, isHexKey } from "@/utils/hex";

const secureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export type KeyImportResult =
  | {
      type: "nsec";
      privateKeyHex: string;
    }
  | {
      type: "hex";
      privateKeyHex: string;
    }
  | {
      type: "mnemonic";
      mnemonic: string;
      privateKeyHex: string;
    };

function normalizeMnemonic(input: string): string {
  return input.trim().toLowerCase().split(/\s+/).join(" ");
}

function privateKeyHexFromMnemonic(mnemonic: string): string {
  const normalized = normalizeMnemonic(mnemonic);
  if (!validateWords({ mnemonic: normalized }).isMnemonicValid) {
    throw new Error("That recovery phrase is not valid. Check the words and their order.");
  }
  const account = accountFromSeedWords({ mnemonic: normalized });
  if (!isHexKey(account.privateKey.hex)) {
    throw new Error("That recovery phrase is not valid. Check the words and their order.");
  }
  return account.privateKey.hex.toLowerCase();
}

export function parseKeyInput(input: string): KeyImportResult {
  const trimmedInput = input.trim();
  const lower = trimmedInput.toLowerCase();

  if (!trimmedInput) {
    throw new Error("Enter an nsec, recovery phrase, or private-key hex.");
  }

  if (lower.startsWith("npub1")) {
    throw new Error(
      "You pasted an npub. That is your public address and is safe to share. Import your nsec private key or recovery phrase instead.",
    );
  }

  if (lower.startsWith("nsec1")) {
    try {
      const decoded = nip19.decode(lower);
      if (decoded.type !== "nsec") {
        throw new Error("wrong type");
      }
      return {
        type: "nsec",
        privateKeyHex: bytesToHex(decoded.data),
      };
    } catch {
      throw new Error("That nsec does not look valid. Check for missing or extra characters.");
    }
  }

  if (lower.length === 64) {
    if (!isHexKey(lower)) {
      throw new Error("That private-key hex contains invalid characters. Use 0-9 and a-f only.");
    }
    return {
      type: "hex",
      privateKeyHex: lower,
    };
  }

  if (/\s/.test(trimmedInput)) {
    const mnemonic = normalizeMnemonic(trimmedInput);
    return {
      type: "mnemonic",
      mnemonic,
      privateKeyHex: privateKeyHexFromMnemonic(mnemonic),
    };
  }

  throw new Error(
    "Invalid key. Paste an nsec, a 12/24-word recovery phrase, or 64-character private-key hex.",
  );
}

async function setPrivateKeyInSecureStorage(input: {
  privateKeyHex: string;
  mnemonic?: string | null;
}): Promise<string> {
  const privateKeyHex = input.privateKeyHex.toLowerCase();
  if (!isHexKey(privateKeyHex)) {
    throw new Error("Expected a 64-character private key.");
  }

  const publicKeyHex = getPublicKey(hexToBytes(privateKeyHex));
  await SecureStore.setItemAsync(
    SECURE_STORE_PRIVATE_KEY_HEX_KEY,
    privateKeyHex,
    secureStoreOptions,
  );

  if (input.mnemonic) {
    await SecureStore.setItemAsync(
      SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
      normalizeMnemonic(input.mnemonic),
      secureStoreOptions,
    );
  } else {
    await SecureStore.deleteItemAsync(SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC);
  }

  await clearNip7Permissions();
  return publicKeyHex;
}

export async function importPrivateKey(input: string): Promise<{
  publicKeyHex: string;
  type: KeyImportResult["type"];
}> {
  const parsed = parseKeyInput(input);
  const publicKeyHex = await setPrivateKeyInSecureStorage({
    privateKeyHex: parsed.privateKeyHex,
    mnemonic: parsed.type === "mnemonic" ? parsed.mnemonic : null,
  });

  return {
    publicKeyHex,
    type: parsed.type,
  };
}

export async function generatePrivateKey(): Promise<{
  mnemonic: string;
  publicKeyHex: string;
}> {
  const mnemonic = normalizeMnemonic(generateSeedWords().mnemonic);
  const privateKeyHex = privateKeyHexFromMnemonic(mnemonic);
  const publicKeyHex = await setPrivateKeyInSecureStorage({
    privateKeyHex,
    mnemonic,
  });

  return {
    mnemonic,
    publicKeyHex,
  };
}

export async function clearPrivateKey(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC);
  await SecureStore.deleteItemAsync(SECURE_STORE_PRIVATE_KEY_HEX_KEY);
  await clearNip7Permissions();
}

export async function getPrivateKeyMnemonicFromSecureStorage(): Promise<
  string | null
> {
  return SecureStore.getItemAsync(SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC);
}

export async function getPrivateKeyHexFromSecureStorage(): Promise<string> {
  const keyHex = await SecureStore.getItemAsync(SECURE_STORE_PRIVATE_KEY_HEX_KEY);
  if (!isHexKey(keyHex)) {
    throw new Error("No Nostroots Browser key is available.");
  }
  return keyHex.toLowerCase();
}

export async function getPrivateKeyBytesFromSecureStorage(): Promise<Uint8Array> {
  return hexToBytes(await getPrivateKeyHexFromSecureStorage());
}

export async function getPublicKeyHexFromSecureStorage(): Promise<string> {
  return getPublicKey(await getPrivateKeyBytesFromSecureStorage());
}

export async function getNsecFromSecureStorage(): Promise<string> {
  const privateKeyHex = await getPrivateKeyHexFromSecureStorage();
  return getBech32PrivateKey({ privateKey: privateKeyHex }).bech32PrivateKey;
}

export async function getHasPrivateKeyInSecureStorage(): Promise<boolean> {
  try {
    await getPrivateKeyHexFromSecureStorage();
    return true;
  } catch {
    return false;
  }
}

export async function signEventTemplate(
  eventTemplate: EventTemplate,
): Promise<VerifiedEvent> {
  const key = await getPrivateKeyBytesFromSecureStorage();
  return finalizeEvent(eventTemplate, key);
}

export async function nip44Encrypt(
  peerPubkeyHex: string,
  plaintext: string,
): Promise<string> {
  if (!isHexKey(peerPubkeyHex)) {
    throw new Error("Invalid peer public key.");
  }
  const conversationKey = nip44.getConversationKey(
    await getPrivateKeyBytesFromSecureStorage(),
    peerPubkeyHex.toLowerCase(),
  );
  return nip44.v2.encrypt(plaintext, conversationKey);
}

export async function nip44Decrypt(
  peerPubkeyHex: string,
  ciphertext: string,
): Promise<string> {
  if (!isHexKey(peerPubkeyHex)) {
    throw new Error("Invalid peer public key.");
  }
  const conversationKey = nip44.getConversationKey(
    await getPrivateKeyBytesFromSecureStorage(),
    peerPubkeyHex.toLowerCase(),
  );
  return nip44.v2.decrypt(ciphertext, conversationKey);
}

export async function nip04Encrypt(
  peerPubkeyHex: string,
  plaintext: string,
): Promise<string> {
  if (!isHexKey(peerPubkeyHex)) {
    throw new Error("Invalid peer public key.");
  }
  return nip04.encrypt(
    await getPrivateKeyBytesFromSecureStorage(),
    peerPubkeyHex.toLowerCase(),
    plaintext,
  );
}

export async function nip04Decrypt(
  peerPubkeyHex: string,
  ciphertext: string,
): Promise<string> {
  if (!isHexKey(peerPubkeyHex)) {
    throw new Error("Invalid peer public key.");
  }
  return nip04.decrypt(
    await getPrivateKeyBytesFromSecureStorage(),
    peerPubkeyHex.toLowerCase(),
    ciphertext,
  );
}
