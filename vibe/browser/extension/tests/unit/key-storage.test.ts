import { describe, expect, it } from "vitest";

import { STORAGE_KEYS } from "../../src/shared/constants";
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
  readAllowedOriginAccess,
  readCachedTrustrootsNip05,
  readPrivateKeyHex,
  rememberAllowedOrigin,
  rememberAllowedOriginMethod,
  revokeAllowedOrigin,
  writeCachedTrustrootsNip05,
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
    const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const parsed = parseKeyInput(mnemonic);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(isHexKey(parsed.privateKeyHex)).toBe(true);
      expect(parsed).toMatchObject({ source: "mnemonic", mnemonic });
    }
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

  it("reads remembered origins as canonical non-Trustroots site approvals", async () => {
    const storage = new MemoryStorage();
    await storage.set({
      [STORAGE_KEYS.allowedOriginAccess]: {
        "https://Treasures.To/path?from=nostroots": { all: true },
        "https://treasures.to": { methods: ["signEvent", "bad"] },
        "https://example.com:8443/app": { all: true },
        "https://nos.trustroots.org": { all: true },
        "file:///tmp/test.html": { all: true },
      },
    });

    expect(await readAllowedOrigins(storage)).toEqual([
      "https://example.com:8443",
      "https://treasures.to",
    ]);
    expect(await readAllowedOriginAccess(storage)).toEqual([
      { origin: "https://example.com:8443", all: true, methods: [] },
      { origin: "https://treasures.to", all: true, methods: ["signEvent"] },
    ]);
  });

  it("stores only normalized remembered origins", async () => {
    const storage = new MemoryStorage();
    await rememberAllowedOrigin("https://Treasures.To/path", storage);
    await rememberAllowedOrigin("https://treasures.to/other", storage);
    await rememberAllowedOrigin("file:///tmp/test.html", storage);
    await rememberAllowedOrigin("https://nos.trustroots.org", storage);

    expect(await readAllowedOrigins(storage)).toEqual(["https://treasures.to"]);
    expect(await storage.get(STORAGE_KEYS.allowedOriginAccess)).toEqual({
      [STORAGE_KEYS.allowedOriginAccess]: {
        "https://treasures.to": { all: true, methods: [] },
      },
    });
  });

  it("stores only normalized remembered action approvals", async () => {
    const storage = new MemoryStorage();
    await rememberAllowedOriginMethod("https://Treasures.To/path", "signEvent", storage);
    await rememberAllowedOriginMethod("https://treasures.to/other", "getPublicKey", storage);
    await rememberAllowedOriginMethod("file:///tmp/test.html", "signEvent", storage);
    await rememberAllowedOriginMethod("https://nos.trustroots.org", "signEvent", storage);

    expect(await readAllowedOriginAccess(storage)).toEqual([
      { origin: "https://treasures.to", all: false, methods: ["getPublicKey", "signEvent"] },
    ]);
  });

  it("revokes normalized remembered origins and leaves other sites intact", async () => {
    const storage = new MemoryStorage();
    await rememberAllowedOrigin("https://treasures.to/app", storage);
    await rememberAllowedOrigin("https://example.com", storage);

    await revokeAllowedOrigin("https://Treasures.To/settings", storage);

    expect(await readAllowedOrigins(storage)).toEqual(["https://example.com"]);
  });

  it("caches Trustroots NIP-05 addresses by public key", async () => {
    const storage = new MemoryStorage();
    await writeCachedTrustrootsNip05(HEX.toUpperCase(), "alice@trustroots.org", storage);

    expect(await readCachedTrustrootsNip05(HEX, storage)).toBe("alice@trustroots.org");
    expect(await readCachedTrustrootsNip05(OTHER_HEX, storage)).toBe(null);
  });
});
