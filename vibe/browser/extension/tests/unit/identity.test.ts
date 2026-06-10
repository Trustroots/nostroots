import { describe, expect, it } from "vitest";

import {
  extractKind0TrustrootsNip05,
  extractKind10390TrustrootsNip05,
  extractKind30390TrustrootsNip05,
  lookupTrustrootsNip05,
  normalizeTrustrootsNip05,
  type NostrEvent,
  type NostrFilter,
} from "../../src/shared/identity";

const PUBKEY = "a".repeat(64);
const OTHER = "b".repeat(64);
const SECRET = "1".repeat(64);

function event(input: Partial<NostrEvent>): NostrEvent {
  return {
    id: Math.random().toString(16).slice(2).padEnd(64, "0"),
    pubkey: PUBKEY,
    created_at: 1,
    kind: 0,
    tags: [],
    content: "",
    ...input,
  };
}

describe("Trustroots identity lookup", () => {
  it("normalizes only trustroots.org NIP-05 addresses", () => {
    expect(normalizeTrustrootsNip05(" Alice@www.trustroots.org ")).toBe("alice@trustroots.org");
    expect(normalizeTrustrootsNip05("alice@example.org")).toBe(null);
  });

  it("extracts Trustroots NIP-05 from kind 0 metadata", () => {
    expect(
      extractKind0TrustrootsNip05(
        [
          event({ kind: 0, created_at: 1, content: JSON.stringify({ nip05: "old@trustroots.org" }) }),
          event({ kind: 0, created_at: 2, content: JSON.stringify({ nip05: "alice@trustroots.org" }) }),
        ],
        PUBKEY,
      ),
    ).toBe("alice@trustroots.org");
  });

  it("extracts Trustroots usernames from kind 10390 tags", () => {
    expect(
      extractKind10390TrustrootsNip05(
        [event({ kind: 10390, tags: [["l", "Alice", "org.trustroots:username"]] })],
        PUBKEY,
      ),
    ).toBe("alice@trustroots.org");
  });

  it("extracts Trustroots usernames from kind 30390 profile claims", () => {
    expect(
      extractKind30390TrustrootsNip05(
        [
          event({
            kind: 30390,
            pubkey: OTHER,
            tags: [["p", PUBKEY]],
            content: JSON.stringify({ trustrootsUsername: "Alice" }),
          }),
        ],
        PUBKEY,
      ),
    ).toBe("alice@trustroots.org");
  });

  it("looks up direct filters before broad fallbacks", async () => {
    const seenFilters: NostrFilter[][] = [];
    const result = await lookupTrustrootsNip05(PUBKEY, SECRET, async (filters) => {
      seenFilters.push(filters);
      if (filters.some((filter) => filter.kinds?.includes(30390))) {
        return [event({ kind: 30390, tags: [["p", PUBKEY]], content: JSON.stringify({ username: "alice" }) })];
      }
      return [];
    });

    expect(result).toBe("alice@trustroots.org");
    expect(seenFilters).toHaveLength(3);
  });
});
