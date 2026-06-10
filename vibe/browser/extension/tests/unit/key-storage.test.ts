import { describe, expect, it } from "vitest";

import { isHexKey } from "../../src/shared/hex";
import {
  generateKey,
  keyImportErrorMessage,
  nsecFromPrivateKey,
  parseKeyInput,
  publicKeyFromPrivateKey,
} from "../../src/shared/keys";
import { MemoryStorage } from "../../src/shared/memory-storage";
import {
  readAllowedOrigins,
  readPrivateKeyHex,
  rememberAllowedOrigin,
  writePrivateKeyHex,
  clearPrivateKey,
} from "../../src/shared/storage";

const HEX = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const OTHER_HEX = "0000000000000000000000000000000000000000000000000000000000000001";

describe("key parsing and single-key storage", () => {
  it("accepts lowercase or uppercase private-key hex", () => {
    expect(parseKeyInput(HEX)).toEqual({ ok: true, privateKeyHex: HEX, source: "hex" });
    expect(parseKeyInput(HEX.toUpperCase())).toEqual({ ok: true, privateKeyHex: HEX, source: "hex" });
  });

  it("round-trips nsec imports", () => {
    const nsec = nsecFromPrivateKey(HEX);
    expect(parseKeyInput(nsec)).toEqual({ ok: true, privateKeyHex: HEX, source: "nsec" });
  });

  it("accepts NIP-06 recovery phrases", () => {
    const parsed = parseKeyInput("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(isHexKey(parsed.privateKeyHex)).toBe(true);
  });

  it("rejects npub and reports private-key copy", () => {
    const result = parseKeyInput("npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d");
    expect(result).toEqual({ ok: false, reason: "npub" });
    if (!result.ok) expect(keyImportErrorMessage(result)).toMatch(/private/i);
  });

  it("generates a valid single profile key", () => {
    const generated = generateKey();
    expect(isHexKey(generated.privateKeyHex)).toBe(true);
    expect(publicKeyFromPrivateKey(generated.privateKeyHex)).toHaveLength(64);
    expect(generated.mnemonic.split(" ")).toHaveLength(12);
  });

  it("replacing or removing the only key clears remembered origins", async () => {
    const storage = new MemoryStorage();
    await writePrivateKeyHex(HEX, storage);
    await rememberAllowedOrigin("https://example.com", storage);
    expect(await readAllowedOrigins(storage)).toEqual(["https://example.com"]);

    await writePrivateKeyHex(OTHER_HEX, storage);
    expect(await readPrivateKeyHex(storage)).toBe(OTHER_HEX);
    expect(await readAllowedOrigins(storage)).toEqual([]);

    await rememberAllowedOrigin("https://example.com", storage);
    await clearPrivateKey(storage);
    expect(await readPrivateKeyHex(storage)).toBe(null);
    expect(await readAllowedOrigins(storage)).toEqual([]);
  });
});
