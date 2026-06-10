import {
  accountFromSeedWords,
  generateSeedWords,
  getBech32PrivateKey,
  validateWords,
} from "nip06";
import { nip19 } from "nostr-tools";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";

import { bytesToHex, hexToBytes, isHexKey, normalizeHexKey } from "./hex";

export type KeyImportResult =
  | { ok: true; privateKeyHex: string; source: "hex" | "nsec" | "mnemonic" }
  | { ok: false; reason: "empty" | "npub" | "invalid" };

function normalizeMnemonic(input: string): string {
  return input.trim().toLowerCase().split(/\s+/).join(" ");
}

function privateKeyFromMnemonic(input: string): string | null {
  const mnemonic = normalizeMnemonic(input);
  if (!validateWords({ mnemonic }).isMnemonicValid) return null;
  const account = accountFromSeedWords({ mnemonic });
  return isHexKey(account.privateKey.hex) ? account.privateKey.hex.toLowerCase() : null;
}

export function parseKeyInput(input: string): KeyImportResult {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) return { ok: false, reason: "empty" };
  if (lower.startsWith("npub1")) return { ok: false, reason: "npub" };

  const hex = normalizeHexKey(trimmed);
  if (hex) return { ok: true, privateKeyHex: hex, source: "hex" };

  if (lower.startsWith("nsec1")) {
    try {
      const decoded = nip19.decode(lower);
      if (decoded.type !== "nsec") return { ok: false, reason: "invalid" };
      return { ok: true, privateKeyHex: bytesToHex(decoded.data), source: "nsec" };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }

  if (/\s/.test(trimmed)) {
    const privateKeyHex = privateKeyFromMnemonic(trimmed);
    return privateKeyHex
      ? { ok: true, privateKeyHex, source: "mnemonic" }
      : { ok: false, reason: "invalid" };
  }

  return { ok: false, reason: "invalid" };
}

export function keyImportErrorMessage(result: Extract<KeyImportResult, { ok: false }>): string {
  switch (result.reason) {
    case "empty":
      return "Paste an nsec, private-key hex, or recovery phrase.";
    case "npub":
      return "That is an npub public address. Import the private nsec or recovery phrase instead.";
    case "invalid":
      return "That key does not look valid. Check for missing characters or misspelled recovery words.";
  }
}

export function generateKey(): { privateKeyHex: string; mnemonic: string } {
  const mnemonic = normalizeMnemonic(generateSeedWords().mnemonic);
  const privateKeyHex = privateKeyFromMnemonic(mnemonic);
  if (!privateKeyHex) throw new Error("Unable to generate a valid recovery phrase.");
  return { privateKeyHex, mnemonic };
}

export function generateRandomKeyHex(): string {
  return bytesToHex(generateSecretKey());
}

export function publicKeyFromPrivateKey(privateKeyHex: string): string {
  return getPublicKey(hexToBytes(privateKeyHex));
}

export function nsecFromPrivateKey(privateKeyHex: string): string {
  return getBech32PrivateKey({ privateKey: privateKeyHex }).bech32PrivateKey;
}

export function npubFromPublicKey(publicKeyHex: string): string {
  return nip19.npubEncode(publicKeyHex);
}
