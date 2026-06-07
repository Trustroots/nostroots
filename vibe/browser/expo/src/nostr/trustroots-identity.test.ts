import type { Event as NostrEvent } from "nostr-tools";

import {
  extractKind0TrustrootsNip05,
  extractKind10390TrustrootsNip05,
  extractKind30390TrustrootsNip05,
  lookupTrustrootsNip05,
  normalizeRelayAuthTemplate,
} from "@/nostr/trustroots-identity";

const publicKeyHex = "a".repeat(64);
const otherPublicKeyHex = "b".repeat(64);

function event(
  overrides: Partial<NostrEvent> & Pick<NostrEvent, "kind">,
): NostrEvent {
  return {
    id: "1".repeat(64),
    pubkey: publicKeyHex,
    created_at: 100,
    tags: [],
    content: "",
    sig: "2".repeat(128),
    ...overrides,
  };
}

describe("trustroots identity", () => {
  it("extracts Trustroots NIP-05 from kind 0 metadata", () => {
    expect(
      extractKind0TrustrootsNip05(
        [
          event({
            kind: 0,
            content: JSON.stringify({ nip05: "Alice@www.trustroots.org" }),
          }),
        ],
        publicKeyHex,
      ),
    ).toBe("alice@trustroots.org");
  });

  it("ignores non-Trustroots and malformed kind 0 metadata", () => {
    expect(
      extractKind0TrustrootsNip05(
        [
          event({
            kind: 0,
            content: JSON.stringify({ nip05: "alice@example.com" }),
          }),
          event({ kind: 0, content: "{" }),
        ],
        publicKeyHex,
      ),
    ).toBeNull();
  });

  it("falls back to Trustroots profile labels", () => {
    expect(
      extractKind10390TrustrootsNip05(
        [
          event({
            kind: 10390,
            tags: [["l", "Alice", "org.trustroots:username"]],
          }),
        ],
        publicKeyHex,
      ),
    ).toBe("alice@trustroots.org");
  });

  it("falls back to targeted and self-authored profile claims", () => {
    expect(
      extractKind30390TrustrootsNip05(
        [
          event({
            kind: 30390,
            pubkey: otherPublicKeyHex,
            tags: [
              ["p", publicKeyHex],
              ["l", "Alice", "org.trustroots:username"],
            ],
          }),
        ],
        publicKeyHex,
      ),
    ).toBe("alice@trustroots.org");

    expect(
      extractKind30390TrustrootsNip05(
        [
          event({
            kind: 30390,
            content: JSON.stringify({ trustrootsUsername: "Bob" }),
          }),
        ],
        publicKeyHex,
      ),
    ).toBe("bob@trustroots.org");
  });

  it("returns null when relay lookup fails", async () => {
    await expect(
      lookupTrustrootsNip05(publicKeyHex, async () => {
        throw new Error("relay unavailable");
      }),
    ).resolves.toBeNull();
  });

  it("prefers kind 0 before fallback events", async () => {
    const readEvents = jest
      .fn()
      .mockResolvedValueOnce([
        event({
          kind: 0,
          content: JSON.stringify({ nip05: "alice@trustroots.org" }),
        }),
      ])
      .mockResolvedValueOnce([
        event({
          kind: 10390,
          tags: [["l", "bob", "org.trustroots:username"]],
        }),
      ]);

    await expect(lookupTrustrootsNip05(publicKeyHex, readEvents)).resolves.toBe(
      "alice@trustroots.org",
    );
    expect(readEvents).toHaveBeenCalledTimes(1);
  });

  it("uses a broad profile-event fallback when targeted filters miss", async () => {
    const readEvents = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        event({
          kind: 30390,
          pubkey: otherPublicKeyHex,
          tags: [["p", publicKeyHex]],
          content: JSON.stringify({ nip05: "alice@trustroots.org" }),
        }),
      ]);

    await expect(lookupTrustrootsNip05(publicKeyHex, readEvents)).resolves.toBe(
      "alice@trustroots.org",
    );
    expect(readEvents).toHaveBeenLastCalledWith([
      { kinds: [0, 10390], limit: 5000 },
      { kinds: [30390], limit: 5000 },
    ]);
  });

  it("normalizes NIP-42 auth relay tags before signing", () => {
    expect(
      normalizeRelayAuthTemplate(
        {
          kind: 22242,
          created_at: 100,
          content: "",
          tags: [
            ["relay", "wss://nip42.trustroots.org/"],
            ["challenge", "abc"],
          ],
        },
        "wss://nip42.trustroots.org",
      ),
    ).toEqual({
      kind: 22242,
      created_at: 100,
      content: "",
      tags: [
        ["relay", "wss://nip42.trustroots.org"],
        ["challenge", "abc"],
      ],
    });
  });
});
