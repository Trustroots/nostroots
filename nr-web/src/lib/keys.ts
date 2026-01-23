import { getPublicKey, nip19 } from "nostr-tools";
import { bytesToHex } from "@noble/hashes/utils";
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";

/**
 * Generate a new nostr key pair
 */
export function generateKeyPair(): {
  privateKey: string;
  publicKey: string;
  mnemonic: string;
} {
  // Generate a mnemonic
  const mnemonic = bip39.generateMnemonic(wordlist, 128);
  const seed = bip39.mnemonicToSeedSync(mnemonic);

  // Derive key using BIP-44 path for nostr: m/44'/1237'/0'/0/0
  const hdKey = HDKey.fromMasterSeed(seed);
  const derivedKey = hdKey.derive("m/44'/1237'/0'/0/0");

  if (!derivedKey.privateKey) {
    throw new Error("Failed to derive private key");
  }

  const privateKey = bytesToHex(derivedKey.privateKey);
  const publicKey = getPublicKey(derivedKey.privateKey);

  return {
    privateKey,
    publicKey,
    mnemonic,
  };
}

/**
 * Import a key from nsec format
 */
export function importNsec(nsec: string): {
  privateKey: string;
  publicKey: string;
} {
  const decoded = nip19.decode(nsec);

  if (decoded.type !== "nsec") {
    throw new Error("Invalid nsec format");
  }

  const privateKey = bytesToHex(decoded.data);
  const publicKey = getPublicKey(decoded.data);

  return {
    privateKey,
    publicKey,
  };
}

/**
 * Import a key from mnemonic
 */
export function importMnemonic(mnemonic: string): {
  privateKey: string;
  publicKey: string;
} {
  // Validate mnemonic
  if (!bip39.validateMnemonic(mnemonic, wordlist)) {
    throw new Error("Invalid mnemonic");
  }

  const seed = bip39.mnemonicToSeedSync(mnemonic);

  // Derive key using BIP-44 path for nostr: m/44'/1237'/0'/0/0
  const hdKey = HDKey.fromMasterSeed(seed);
  const derivedKey = hdKey.derive("m/44'/1237'/0'/0/0");

  if (!derivedKey.privateKey) {
    throw new Error("Failed to derive private key");
  }

  const privateKey = bytesToHex(derivedKey.privateKey);
  const publicKey = getPublicKey(derivedKey.privateKey);

  return {
    privateKey,
    publicKey,
  };
}
