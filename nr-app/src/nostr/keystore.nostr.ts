import { isHexKey } from "@/common/utils";
import {
  SECURE_STORE_PRIVATE_KEY_HEX_KEY,
  SECURE_STORE_PRIVATE_KEY_HEX_NMEONIC,
} from "@/constants";
import * as SecureStore from "expo-secure-store";
import {
  Event,
  EventTemplate,
  finalizeEvent,
  VerifiedEvent,
} from "nostr-tools";
import { hexToBytes } from "@noble/hashes/utils";
import { accountFromSeedWords } from "nip06";

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
}

export async function signEventTemplate(
  eventTemplate: EventTemplate,
): Promise<VerifiedEvent> {
  const key = await getPrivateKeyBytes();
  const event = finalizeEvent(eventTemplate, key);
  return event;
}
