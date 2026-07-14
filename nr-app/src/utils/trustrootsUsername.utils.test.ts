import {
  normalizeTrustrootsUsername,
  validateTrustrootsUsername,
} from "./trustrootsUsername.utils";

describe("trustrootsUsername.utils", () => {
  describe("normalizeTrustrootsUsername()", () => {
    it("trims and lowercases username input", () => {
      expect(normalizeTrustrootsUsername("  Alice  ")).toBe("alice");
    });
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

    it("rejects email addresses", () => {
      expect(validateTrustrootsUsername("alice@example.com")).toEqual({
        success: false,
        username: null,
        error: "Enter your Trustroots username, not your email address.",
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
