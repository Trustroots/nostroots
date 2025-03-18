import {
  SECURE_STORE_PRIVATE_KEY_HEX_KEY,
  SECURE_STORE_PRIVATE_KEY_HEX_NMEONIC,
} from "@/constants";
import { hexToBytes } from "@noble/hashes/utils";
import { isHexKey } from "@trustroots/nr-common";
import * as SecureStore from "expo-secure-store";
import { accountFromSeedWords } from "nip06";
import { EventTemplate, finalizeEvent, VerifiedEvent } from "nostr-tools";

export async function getPrivateKeyHex(): Promise<string> {
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

export async function getPrivateKeyBytes(): Promise<Uint8Array> {
  const keyHex = await getPrivateKeyHex();
  const keyBytes = hexToBytes(keyHex);
  return keyBytes;
}

export async function getPrivateKeyMnemonic(): Promise<string> {
  const mnemonic = await SecureStore.getItemAsync(
    SECURE_STORE_PRIVATE_KEY_HEX_NMEONIC,
  );
  if (mnemonic === null) {
    throw new Error("#ATaXag-failed-to-get-mnemonic");
  }
  return mnemonic;
}

export async function getHasPrivateKeyInSecureStorage(): Promise<boolean> {
  const mnemonic = await SecureStore.getItemAsync(
    SECURE_STORE_PRIVATE_KEY_HEX_NMEONIC,
  );
  const hasKey = typeof mnemonic === "string" && mnemonic.length > 0;
  return hasKey;
}

export async function setPrivateKeyMnemonic(keyMnemonic: string) {
  const account = accountFromSeedWords({ mnemonic: keyMnemonic });
  await SecureStore.setItemAsync(
    SECURE_STORE_PRIVATE_KEY_HEX_NMEONIC,
    keyMnemonic,
    {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    },
  );
  await SecureStore.setItemAsync(
    SECURE_STORE_PRIVATE_KEY_HEX_KEY,
    account.privateKey.hex,
    {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    },
  );
  return account;
}

export async function signEventTemplate(
  eventTemplate: EventTemplate,
): Promise<VerifiedEvent> {
  const key = await getPrivateKeyBytes();
  const event = finalizeEvent(eventTemplate, key);
  return event;
}

export function derivePublicKeyHexFromMnemonic(mnemonic: string) {
  const account = accountFromSeedWords({ mnemonic });
  return account.publicKey.hex;
}
