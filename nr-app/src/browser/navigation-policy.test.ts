import {
  navigationDecision,
  normalizeDeveloperUrl,
} from "@/browser/navigation-policy";

describe("navigation policy", () => {
  it("normalizes developer URLs", () => {
    expect(normalizeDeveloperUrl("example.com")).toBe("https://example.com");
    expect(normalizeDeveloperUrl("http://example.com")).toBe(
      "http://example.com",
    );
    expect(normalizeDeveloperUrl("   ")).toBe("https://nos.trustroots.org/");
  });

  it("allows Nostroots normally and arbitrary HTTP(S) in developer mode", () => {
    expect(navigationDecision("https://nos.trustroots.org/", false)).toBe(
      "allow",
    );
    expect(navigationDecision("https://example.com/", false)).toBe(
      "open-externally",
    );
    expect(navigationDecision("mailto:hello@example.com", false)).toBe(
      "open-externally",
    );
    expect(navigationDecision("https://example.com/", true)).toBe("allow");
    expect(navigationDecision("not a url", true)).toBe("cancel");
  });
});
