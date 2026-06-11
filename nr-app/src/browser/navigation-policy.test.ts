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

  it("allows HTTP(S) in the browser and opens other schemes externally", () => {
    expect(navigationDecision("https://nos.trustroots.org/")).toBe("allow");
    expect(navigationDecision("https://example.com/")).toBe("allow");
    expect(navigationDecision("mailto:hello@example.com")).toBe(
      "open-externally",
    );
    expect(navigationDecision("not a url")).toBe("cancel");
  });
});
