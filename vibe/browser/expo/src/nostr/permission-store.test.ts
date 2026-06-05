import * as SecureStore from "expo-secure-store";

import {
  clearNip7Permissions,
  getPermissionEntries,
  isRememberedOrigin,
  isTrustedNip7Origin,
  originForUrl,
  recordTrustedOriginUse,
  rememberOrigin,
  revokeOrigin,
} from "@/nostr/permission-store";

beforeEach(() => {
  (SecureStore as unknown as { __reset: () => void }).__reset();
});

describe("NIP-07 permission store", () => {
  it("detects origins and trusted domains without accepting lookalikes", () => {
    expect(originForUrl("https://nos.trustroots.org/#stats")).toBe(
      "https://nos.trustroots.org",
    );
    expect(isTrustedNip7Origin("https://trustroots.org")).toBe(true);
    expect(isTrustedNip7Origin("https://maps.hitchwiki.org")).toBe(true);
    expect(isTrustedNip7Origin("https://trustroots.org.example.com")).toBe(false);
  });

  it("remembers, revokes, records, and clears origins", async () => {
    await rememberOrigin("https://example.com");
    await recordTrustedOriginUse("https://nos.trustroots.org");

    await expect(isRememberedOrigin("https://example.com")).resolves.toBe(true);
    await expect(getPermissionEntries()).resolves.toEqual([
      expect.objectContaining({
        origin: "https://example.com",
        detail: "Always allowed",
        canRevoke: true,
      }),
      expect.objectContaining({
        origin: "https://nos.trustroots.org",
        detail: "Trusted *.trustroots.org site",
        canRevoke: false,
      }),
    ]);

    await revokeOrigin("https://example.com");
    await expect(isRememberedOrigin("https://example.com")).resolves.toBe(false);

    await clearNip7Permissions();
    await expect(getPermissionEntries()).resolves.toEqual([]);
  });
});
