import "react-native-get-random-values";

import {
  accountFromSeedWords,
  generateSeedWords,
  getBech32PrivateKey,
} from "nip06";
import { EventTemplate, finalizeEvent, getPublicKey, nip04, nip44 } from "nostr-tools";
import { nip19 } from "nostr-tools";
import * as SecureStore from "expo-secure-store";

import {
  SECURE_STORE_PRIVATE_KEY_HEX_KEY,
  SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
} from "@/constants";
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
      type: "mnemonic";
      mnemonic: string;
    };

export function parseKeyInput(input: string): KeyImportResult {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    throw new Error("Please enter a key.");
  }

  if (trimmedInput.startsWith("nsec")) {
    const decoded = nip19.decode(trimmedInput);
    if (decoded.type !== "nsec") {
      throw new Error("That nsec key does not look right.");
    }
    return {
      type: "nsec",
      privateKeyHex: bytesToHex(decoded.data),
    };
  }

  const account = accountFromSeedWords({ mnemonic: trimmedInput });
  if (!isHexKey(account.privateKey.hex)) {
    throw new Error("That mnemonic does not look right.");
  }

  return {
    type: "mnemonic",
    mnemonic: trimmedInput,
  };
}

export async function setPrivateKeyInSecureStorage(
  input: { mnemonic: string } | { privateKeyHex: string },
): Promise<string> {
  if ("mnemonic" in input) {
    const account = accountFromSeedWords({ mnemonic: input.mnemonic });
    await SecureStore.setItemAsync(
      SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
      input.mnemonic,
      secureStoreOptions,
    );
    await SecureStore.setItemAsync(
      SECURE_STORE_PRIVATE_KEY_HEX_KEY,
      account.privateKey.hex,
      secureStoreOptions,
    );
    return account.publicKey.hex;
  }

  if (!isHexKey(input.privateKeyHex)) {
    throw new Error("Expected a 64-character private key.");
  }

  const publicKeyHex = getPublicKey(hexToBytes(input.privateKeyHex));
  await SecureStore.deleteItemAsync(SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC);
  await SecureStore.setItemAsync(
    SECURE_STORE_PRIVATE_KEY_HEX_KEY,
    input.privateKeyHex.toLowerCase(),
    secureStoreOptions,
  );
  return publicKeyHex;
}

export async function importPrivateKey(input: string): Promise<{
  publicKeyHex: string;
  type: KeyImportResult["type"];
}> {
  const parsed = parseKeyInput(input);
  const publicKeyHex =
    parsed.type === "mnemonic"
      ? await setPrivateKeyInSecureStorage({ mnemonic: parsed.mnemonic })
      : await setPrivateKeyInSecureStorage({
          privateKeyHex: parsed.privateKeyHex,
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
  const mnemonic = generateSeedWords().mnemonic;
  const publicKeyHex = await setPrivateKeyInSecureStorage({ mnemonic });

  return {
    mnemonic,
    publicKeyHex,
  };
}

export async function clearPrivateKey(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC);
  await SecureStore.deleteItemAsync(SECURE_STORE_PRIVATE_KEY_HEX_KEY);
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
): Promise<ReturnType<typeof finalizeEvent>> {
  const key = await getPrivateKeyBytesFromSecureStorage();
  return finalizeEvent(eventTemplate, key);
}

export async function nip44Encrypt(
  peerPubkeyHex: string,
  plaintext: string,
): Promise<string> {
  if (!isHexKey(peerPubkeyHex)) {
    throw new Error("Invalid NIP-44 peer public key.");
  }
  const conversationKey = nip44.getConversationKey(
    await getPrivateKeyBytesFromSecureStorage(),
    peerPubkeyHex,
  );
  return nip44.v2.encrypt(plaintext, conversationKey);
}

export async function nip44Decrypt(
  peerPubkeyHex: string,
  ciphertext: string,
): Promise<string> {
  if (!isHexKey(peerPubkeyHex)) {
    throw new Error("Invalid NIP-44 peer public key.");
  }
  const conversationKey = nip44.getConversationKey(
    await getPrivateKeyBytesFromSecureStorage(),
    peerPubkeyHex,
  );
  return nip44.v2.decrypt(ciphertext, conversationKey);
}

export async function nip04Encrypt(
  peerPubkeyHex: string,
  plaintext: string,
): Promise<string> {
  if (!isHexKey(peerPubkeyHex)) {
    throw new Error("Invalid NIP-04 peer public key.");
  }
  return nip04.encrypt(
    await getPrivateKeyHexFromSecureStorage(),
    peerPubkeyHex,
    plaintext,
  );
}

export async function nip04Decrypt(
  peerPubkeyHex: string,
  ciphertext: string,
): Promise<string> {
  if (!isHexKey(peerPubkeyHex)) {
    throw new Error("Invalid NIP-04 peer public key.");
  }
  return nip04.decrypt(
    await getPrivateKeyHexFromSecureStorage(),
    peerPubkeyHex,
    ciphertext,
  );
}
