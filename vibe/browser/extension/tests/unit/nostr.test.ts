import { describe, expect, it } from "vitest";

import { publicKeyFromPrivateKey } from "../../src/shared/keys";
import {
  nip04Decrypt,
  nip04Encrypt,
  nip44Decrypt,
  nip44Encrypt,
  signNostrEvent,
} from "../../src/shared/nostr";

const ALICE = "0000000000000000000000000000000000000000000000000000000000000001";
const BOB = "0000000000000000000000000000000000000000000000000000000000000002";

describe("Nostr operations", () => {
  it("signs and verifies event templates", () => {
    const signed = signNostrEvent(ALICE, {
      kind: 1,
      created_at: 1,
      tags: [["t", "nostroots"]],
      content: "hello",
    });

    expect(signed.kind).toBe(1);
    expect(signed.content).toBe("hello");
    expect(signed.pubkey).toBe(publicKeyFromPrivateKey(ALICE));
    expect(signed.id).toHaveLength(64);
    expect(signed.sig).toHaveLength(128);
  });

  it("encrypts and decrypts with NIP-44", async () => {
    const bobPubkey = publicKeyFromPrivateKey(BOB);
    const alicePubkey = publicKeyFromPrivateKey(ALICE);
    const cipher = await nip44Encrypt(ALICE, bobPubkey, "secret");
    await expect(nip44Decrypt(BOB, alicePubkey, cipher)).resolves.toBe("secret");
  });

  it("encrypts and decrypts with NIP-04", async () => {
    const bobPubkey = publicKeyFromPrivateKey(BOB);
    const alicePubkey = publicKeyFromPrivateKey(ALICE);
    const cipher = await nip04Encrypt(ALICE, bobPubkey, "secret");
    await expect(nip04Decrypt(BOB, alicePubkey, cipher)).resolves.toBe("secret");
  });

  it("rejects invalid peers", async () => {
    await expect(nip44Encrypt(ALICE, "bad", "secret")).rejects.toThrow(/peer public key/i);
  });
});
