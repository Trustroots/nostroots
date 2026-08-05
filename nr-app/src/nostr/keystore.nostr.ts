import {
  SECURE_STORE_PRIVATE_KEY_HEX_KEY,
  SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
} from "@/constants";
import { hexToBytes } from "@noble/hashes/utils";
import { isHexKey } from "@trustroots/nr-common";
import * as SecureStore from "expo-secure-store";
import { accountFromSeedWords } from "nip06";
import {
  EventTemplate,
  finalizeEvent,
  getPublicKey,
  nip04,
  nip44,
  VerifiedEvent,
} from "nostr-tools";

const SecureStoreKeySettings = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export async function getPrivateKeyHexFromSecureStorage(): Promise<string> {
  const result = await SecureStore.getItemAsync(
    SECURE_STORE_PRIVATE_KEY_HEX_KEY,
  );
  if (result === null) {
    throw new Error("#1gQIQy-no-key-available");
  }
  if (!isHexKey(result)) {
    throw new Error("#1RCMGy-invalid-key-retrieved");
  }
  return result;
}

export async function getPrivateKeyBytesFromSecureStorage(): Promise<Uint8Array> {
  const keyHex = await getPrivateKeyHexFromSecureStorage();
  const keyBytes = hexToBytes(keyHex);
  return keyBytes;
}

export async function getPrivateKeyMnemonicFromSecureStorage(): Promise<string> {
  const mnemonic = await SecureStore.getItemAsync(
    SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
  );
  if (mnemonic === null) {
    throw new Error("#ATaXag-failed-to-get-mnemonic");
  }
  return mnemonic;
}

export async function getHasPrivateKeyMnemonicInSecureStorage(): Promise<boolean> {
  try {
    const mnemonic = await getPrivateKeyMnemonicFromSecureStorage();
    const privateKeyHex = await getPrivateKeyHexFromSecureStorage();
    return accountFromSeedWords({ mnemonic }).privateKey.hex === privateKeyHex;
  } catch {
    return false;
  }
}

export async function getHasPrivateKeyHexInSecureStorage(): Promise<boolean> {
  try {
    await getPrivateKeyHexFromSecureStorage();
    return true;
  } catch {
    return false;
  }
}

export async function getHasPrivateKeyInSecureStorage(): Promise<boolean> {
  const hasMnemonic = await getHasPrivateKeyMnemonicInSecureStorage();
  if (hasMnemonic) {
    return true;
  }
  return getHasPrivateKeyHexInSecureStorage();
}

export async function getPublicKeyHexFromSecureStorage(): Promise<
  | {
      hasMnemonicInSecureStorage: boolean;
      publicKeyHex: string;
    }
  | undefined
> {
  try {
    const privateKeyHex = await getPrivateKeyHexFromSecureStorage();
    const publicKeyHex = getPublicKey(hexToBytes(privateKeyHex));
    let hasMatchingMnemonic = false;

    if (await getHasPrivateKeyMnemonicInSecureStorage()) {
      const mnemonic = await getPrivateKeyMnemonicFromSecureStorage();
      const account = accountFromSeedWords({ mnemonic });
      hasMatchingMnemonic = account.privateKey.hex === privateKeyHex;
    }

    return {
      hasMnemonicInSecureStorage: hasMatchingMnemonic,
      publicKeyHex,
    };
  } catch {
    // TODO: handle error
  }
}

export async function getPublicKeyHexStringFromSecureStorage(): Promise<string> {
  const privateKeyHexBytes = await getPrivateKeyBytesFromSecureStorage();
  return getPublicKey(privateKeyHexBytes);
}

export async function setPrivateKeyInSecureStorage(
  input: { mnemonic: string } | { privateKeyHex: string },
) {
  const previousPrivateKey = await SecureStore.getItemAsync(
    SECURE_STORE_PRIVATE_KEY_HEX_KEY,
  );
  const previousMnemonic = await SecureStore.getItemAsync(
    SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
  );

  let mnemonic: string | undefined;
  let privateKeyHex: string;
  if ("mnemonic" in input) {
    mnemonic = input.mnemonic;
    privateKeyHex = accountFromSeedWords({ mnemonic }).privateKey.hex;
  } else {
    privateKeyHex = input.privateKeyHex;
  }
  const publicKeyHex = getPublicKey(hexToBytes(privateKeyHex));

  try {
    await SecureStore.setItemAsync(
      SECURE_STORE_PRIVATE_KEY_HEX_KEY,
      privateKeyHex,
      SecureStoreKeySettings,
    );

    if (mnemonic) {
      await SecureStore.setItemAsync(
        SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
        mnemonic,
        SecureStoreKeySettings,
      );
    } else {
      await SecureStore.deleteItemAsync(SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC);
    }

    return publicKeyHex;
  } catch (error) {
    await Promise.allSettled([
      restoreSecureStoreValue(
        SECURE_STORE_PRIVATE_KEY_HEX_KEY,
        previousPrivateKey,
      ),
      restoreSecureStoreValue(
        SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
        previousMnemonic,
      ),
    ]);
    throw error;
  }
}

async function restoreSecureStoreValue(key: string, value: string | null) {
  if (value === null) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await SecureStore.setItemAsync(key, value, SecureStoreKeySettings);
  }
}

export async function signEventTemplate(
  eventTemplate: EventTemplate,
): Promise<VerifiedEvent> {
  const key = await getPrivateKeyBytesFromSecureStorage();
  const event = finalizeEvent(eventTemplate, key);
  return event;
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

export function derivePublicKeyHexFromMnemonic(mnemonic: string) {
  const account = accountFromSeedWords({ mnemonic });
  return account.publicKey.hex;
}
