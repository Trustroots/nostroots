import {
  buildTrustrootsNip05Identifier,
  normalizeTrustrootsUsername,
  validateTrustrootsUsername,
} from "./trustrootsUsername.utils";

describe("trustrootsUsername.utils", () => {
  describe("normalizeTrustrootsUsername()", () => {
    it("trims and lowercases username input", () => {
      expect(normalizeTrustrootsUsername("  Alice  ")).toBe("alice");
    });
  });

  describe("buildTrustrootsNip05Identifier()", () => {
    it.each([
      ["lowercase", "sunhopper", "sunhopper@trustroots.org"],
      ["uppercase", "MOONFERRY", "moonferry@trustroots.org"],
      ["mixed case", "  RiVerKiTe ", "riverkite@trustroots.org"],
    ])(
      "builds a lowercased identifier from %s input",
      (_case, input, expected) => {
        expect(buildTrustrootsNip05Identifier(input)).toBe(expected);
      },
    );
  });

  describe("validateTrustrootsUsername()", () => {
    it("accepts a simple username", () => {
      expect(validateTrustrootsUsername(" Alice ")).toEqual({
        success: true,
        username: "alice",
        error: null,
      });
    });

    it("rejects empty input", () => {
      expect(validateTrustrootsUsername(" ")).toEqual({
        success: false,
        username: null,
        error: "Enter your Trustroots username.",
      });
    });

    it("accepts an @-prefixed username", () => {
      expect(validateTrustrootsUsername(" @Alice ")).toEqual({
        success: true,
        username: "alice",
        error: null,
      });
    });

    it("accepts a trustroots.org address and strips the domain", () => {
      expect(validateTrustrootsUsername("Alice@Trustroots.org")).toEqual({
        success: true,
        username: "alice",
        error: null,
      });
    });

    it("rejects a non-Trustroots email address, which we decline to look up", () => {
      expect(validateTrustrootsUsername("alice@example.com")).toEqual({
        success: false,
        username: null,
        error:
          "That looks like an email address. We avoid email lookups for security reasons — please use your Trustroots username.",
      });
    });

    it("rejects an address with more than one @", () => {
      expect(validateTrustrootsUsername("a@b@trustroots.org")).toEqual({
        success: false,
        username: null,
        error: "Enter only your Trustroots username.",
      });
    });

    it("rejects a bare @ with no username", () => {
      expect(validateTrustrootsUsername("@")).toEqual({
        success: false,
        username: null,
        error: "Enter your Trustroots username.",
      });
    });

    it.each([
      "alice bob",
      "https://trustroots.org/alice",
      "alice/bob",
      "alice\\bob",
    ])("rejects path-like or whitespace input: %s", (input) => {
      expect(validateTrustrootsUsername(input)).toEqual({
        success: false,
        username: null,
        error: "Enter only your Trustroots username.",
      });
    });
  });
});
