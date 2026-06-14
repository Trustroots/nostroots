import { describe, expect, it } from "vitest";

import { isExtensionAllowedPageOrigin, isTrustedOrigin, normalizeOrigin } from "../../src/shared/origins";
import { permissionDecisionForOrigin, rememberOriginIfRequested } from "../../src/shared/permissions";
import { MemoryStorage } from "../../src/shared/memory-storage";
import {
  readAllowedOrigins,
  readAllowedOriginAccess,
  rememberAllowedOrigin,
  rememberAllowedOriginMethod,
  revokeAllowedOrigin,
} from "../../src/shared/storage";

describe("origin permissions", () => {
  it("normalizes web origins", () => {
    expect(normalizeOrigin("https://Nos.Trustroots.Org/path")).toBe("https://nos.trustroots.org");
    expect(normalizeOrigin("https://Treasures.To/login?next=/map#top")).toBe("https://treasures.to");
    expect(normalizeOrigin("https://example.com:8443/path")).toBe("https://example.com:8443");
    expect(normalizeOrigin("http://LOCALHOST:5173/path")).toBe("http://localhost:5173");
    expect(normalizeOrigin("file:///tmp/test.html")).toBe(null);
    expect(normalizeOrigin("treasures.to")).toBe(null);
  });

  it("trusts Trustroots subdomains only", () => {
    expect(isTrustedOrigin("https://nos.trustroots.org")).toBe(true);
    expect(isTrustedOrigin("https://trustroots.org")).toBe(true);
    expect(isTrustedOrigin("https://www.trustroots.org")).toBe(true);
    expect(isTrustedOrigin("https://eviltrustroots.org")).toBe(false);
    expect(isTrustedOrigin("https://trustroots.org.evil.example")).toBe(false);
  });

  it("allows https and local dev pages in the manifest policy", () => {
    expect(isExtensionAllowedPageOrigin("https://example.com")).toBe(true);
    expect(isExtensionAllowedPageOrigin("https://treasures.to")).toBe(true);
    expect(isExtensionAllowedPageOrigin("http://localhost:5173")).toBe(true);
    expect(isExtensionAllowedPageOrigin("http://127.0.0.1:5173")).toBe(true);
    expect(isExtensionAllowedPageOrigin("http://app.localhost:5173")).toBe(true);
    expect(isExtensionAllowedPageOrigin("http://example.com")).toBe(false);
    expect(isExtensionAllowedPageOrigin("file:///tmp/index.html")).toBe(false);
  });

  it("auto-allows Trustroots, prompts unknown origins, and allows remembered origins", async () => {
    const storage = new MemoryStorage();
    expect(await permissionDecisionForOrigin("https://nos.trustroots.org", "signEvent", storage)).toBe("allowed");
    expect(await permissionDecisionForOrigin("https://example.com", "signEvent", storage)).toBe("prompt");
    await rememberAllowedOrigin("https://example.com", storage);
    expect(await permissionDecisionForOrigin("https://example.com", "signEvent", storage)).toBe("allowed");
    expect(await permissionDecisionForOrigin("file:///tmp/index.html", "signEvent", storage)).toBe("blocked");
  });

  it("normalizes remembered origins before permission checks", async () => {
    const storage = new MemoryStorage();
    await rememberAllowedOrigin("https://Treasures.To/app?mode=nostr", storage);

    expect(await readAllowedOrigins(storage)).toEqual(["https://treasures.to"]);
    expect(await permissionDecisionForOrigin("https://treasures.to/map", "signEvent", storage)).toBe("allowed");
    expect(await permissionDecisionForOrigin("https://www.treasures.to", "signEvent", storage)).toBe("prompt");
  });

  it("allows only remembered actions when a site is granted specific access", async () => {
    const storage = new MemoryStorage();
    await rememberAllowedOriginMethod("https://treasures.to/app", "signEvent", storage);

    expect(await readAllowedOriginAccess(storage)).toEqual([
      { origin: "https://treasures.to", all: false, methods: ["signEvent"] },
    ]);
    expect(await permissionDecisionForOrigin("https://treasures.to", "signEvent", storage)).toBe("allowed");
    expect(await permissionDecisionForOrigin("https://treasures.to", "getPublicKey", storage)).toBe("prompt");
  });

  it("remembers prompt decisions as either these actions or everything", async () => {
    const storage = new MemoryStorage();

    await rememberOriginIfRequested("https://treasures.to", "signEvent", "always_allow_method", storage);
    expect(await permissionDecisionForOrigin("https://treasures.to", "signEvent", storage)).toBe("allowed");
    expect(await permissionDecisionForOrigin("https://treasures.to", "getPublicKey", storage)).toBe("prompt");

    await rememberOriginIfRequested("https://treasures.to", "getPublicKey", "always_allow_all", storage);
    expect(await permissionDecisionForOrigin("https://treasures.to", "nip44.decrypt", storage)).toBe("allowed");
  });

  it("does not remember automatic Trustroots access as a manual site approval", async () => {
    const storage = new MemoryStorage();
    await rememberAllowedOrigin("https://nos.trustroots.org", storage);
    await rememberAllowedOrigin("https://www.trustroots.org/profile/alice", storage);

    expect(await readAllowedOrigins(storage)).toEqual([]);
  });

  it("revokes remembered origins using canonical URL comparison", async () => {
    const storage = new MemoryStorage();
    await rememberAllowedOrigin("https://treasures.to/app", storage);
    await rememberAllowedOrigin("https://example.com", storage);

    await revokeAllowedOrigin("https://Treasures.To/settings?tab=nostr", storage);

    expect(await readAllowedOrigins(storage)).toEqual(["https://example.com"]);
    expect(await permissionDecisionForOrigin("https://treasures.to", "signEvent", storage)).toBe("prompt");
  });
});
