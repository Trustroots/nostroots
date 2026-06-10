import { describe, expect, it } from "vitest";

import { isExtensionAllowedPageOrigin, isTrustedOrigin, normalizeOrigin } from "../../src/shared/origins";
import { permissionDecisionForOrigin } from "../../src/shared/permissions";
import { MemoryStorage } from "../../src/shared/memory-storage";
import { rememberAllowedOrigin } from "../../src/shared/storage";

describe("origin permissions", () => {
  it("normalizes web origins", () => {
    expect(normalizeOrigin("https://Nos.Trustroots.Org/path")).toBe("https://nos.trustroots.org");
    expect(normalizeOrigin("file:///tmp/test.html")).toBe(null);
  });

  it("trusts Trustroots subdomains only", () => {
    expect(isTrustedOrigin("https://nos.trustroots.org")).toBe(true);
    expect(isTrustedOrigin("https://trustroots.org")).toBe(true);
    expect(isTrustedOrigin("https://eviltrustroots.org")).toBe(false);
  });

  it("allows https and local dev pages in the manifest policy", () => {
    expect(isExtensionAllowedPageOrigin("https://example.com")).toBe(true);
    expect(isExtensionAllowedPageOrigin("http://localhost:5173")).toBe(true);
    expect(isExtensionAllowedPageOrigin("http://127.0.0.1:5173")).toBe(true);
    expect(isExtensionAllowedPageOrigin("http://example.com")).toBe(false);
  });

  it("auto-allows Trustroots, prompts unknown origins, and allows remembered origins", async () => {
    const storage = new MemoryStorage();
    expect(await permissionDecisionForOrigin("https://nos.trustroots.org", storage)).toBe("allowed");
    expect(await permissionDecisionForOrigin("https://example.com", storage)).toBe("prompt");
    await rememberAllowedOrigin("https://example.com", storage);
    expect(await permissionDecisionForOrigin("https://example.com", storage)).toBe("allowed");
    expect(await permissionDecisionForOrigin("file:///tmp/index.html", storage)).toBe("blocked");
  });
});
