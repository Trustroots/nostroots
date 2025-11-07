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
    if (typeof mnemonic === "string" && mnemonic.length > 10) {
      return true;
    }
    return false;
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
  try {
    const hasMnemonic = await getHasPrivateKeyMnemonicInSecureStorage();
    if (hasMnemonic) {
      return true;
    }
    const hasHex = await getHasPrivateKeyHexInSecureStorage();
    return hasHex;
  } catch {
    return false;
  }
}

export async function getPublicKeyHexFromSecureStorage(): Promise<
  | {
      hasMnemonicInSecureStorage: boolean;
      publicKeyHex: string;
    }
  | undefined
> {
  try {
    const hasMnemonic = await getHasPrivateKeyMnemonicInSecureStorage();
    if (hasMnemonic) {
      const mnemonic = await getPrivateKeyMnemonicFromSecureStorage();
      const account = accountFromSeedWords({ mnemonic });
      return {
        hasMnemonicInSecureStorage: true,
        publicKeyHex: account.publicKey.hex,
      };
    } else {
      const hasPrivateKeyHex = await getHasPrivateKeyHexInSecureStorage();
      if (!hasPrivateKeyHex) {
        return;
      }
      const privateKeyHexBytes = await getPrivateKeyBytesFromSecureStorage();
      const publicKeyHex = getPublicKey(privateKeyHexBytes);
      return {
        hasMnemonicInSecureStorage: false,
        publicKeyHex,
      };
    }
  } catch {}
}

export async function setPrivateKeyInSecureStorage(
  input: { mnemonic: string } | { privateKeyHex: string },
) {
  if ("mnemonic" in input) {
    const { mnemonic } = input;
    const account = accountFromSeedWords({ mnemonic: mnemonic });
    await SecureStore.setItemAsync(
      SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
      mnemonic,
      SecureStoreKeySettings,
    );
    await SecureStore.setItemAsync(
      SECURE_STORE_PRIVATE_KEY_HEX_KEY,
      account.privateKey.hex,
      SecureStoreKeySettings,
    );
    return account.publicKey.hex;
  } else {
    const { privateKeyHex } = input;
    const privateKeyHexBytes = hexToBytes(privateKeyHex);
    console.log("#Nr3YsH got bytes", privateKeyHex, privateKeyHexBytes);
    try {
      debugger;
      const publicKeyHex = getPublicKey(privateKeyHexBytes);
      console.log("#EFGGEx got hex");
      await SecureStore.deleteItemAsync(SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC);
      await SecureStore.setItemAsync(
        SECURE_STORE_PRIVATE_KEY_HEX_KEY,
        privateKeyHex,
        SecureStoreKeySettings,
      );
      return publicKeyHex;
    } catch (error) {
      console.error("#85VtuH got error", error);
      throw error;
    }
  }
}

export async function signEventTemplate(
  eventTemplate: EventTemplate,
): Promise<VerifiedEvent> {
  const key = await getPrivateKeyBytesFromSecureStorage();
  const event = finalizeEvent(eventTemplate, key);
  return event;
}

export function derivePublicKeyHexFromMnemonic(mnemonic: string) {
  const account = accountFromSeedWords({ mnemonic });
  return account.publicKey.hex;
}
