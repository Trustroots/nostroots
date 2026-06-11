import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getPermissionEntries,
  isTrustedNip7Origin,
  originForUrl,
  recordTrustedOriginUse,
  rememberOrigin,
  revokeOrigin,
} from "@/browser/permission-store";

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("NIP-07 permission store", () => {
  it("normalizes origins and recognizes trusted domains", () => {
    expect(originForUrl("https://nos.trustroots.org/#stats")).toBe(
      "https://nos.trustroots.org",
    );
    expect(isTrustedNip7Origin("https://trustroots.org")).toBe(true);
    expect(isTrustedNip7Origin("https://maps.hitchwiki.org")).toBe(true);
    expect(isTrustedNip7Origin("https://trustroots.org.example.com")).toBe(
      false,
    );
  });

  it("lists trusted and remembered origins", async () => {
    await recordTrustedOriginUse("https://nos.trustroots.org");
    await rememberOrigin("https://example.com", "getPublicKey");
    await rememberOrigin("https://example.com", "signEvent");

    await expect(getPermissionEntries()).resolves.toEqual([
      {
        id: '["https://example.com","getPublicKey"]-remembered',
        origin: "https://example.com",
        method: "getPublicKey",
        displayName: "example.com",
        detail: "Read public key",
        kind: "remembered",
        canRevoke: true,
      },
      {
        id: '["https://example.com","signEvent"]-remembered',
        origin: "https://example.com",
        method: "signEvent",
        displayName: "example.com",
        detail: "Sign events",
        kind: "remembered",
        canRevoke: true,
      },
      {
        id: "https://nos.trustroots.org-trusted",
        origin: "https://nos.trustroots.org",
        method: "getPublicKey",
        displayName: "nos.trustroots.org",
        detail: "Trusted *.trustroots.org site",
        kind: "trusted",
        canRevoke: false,
      },
    ]);
  });

  it("revokes remembered origin methods", async () => {
    await rememberOrigin("https://example.com", "getPublicKey");
    await rememberOrigin("https://example.com", "signEvent");
    await revokeOrigin("https://example.com", "getPublicKey");

    await expect(getPermissionEntries()).resolves.toEqual([
      expect.objectContaining({
        origin: "https://example.com",
        method: "signEvent",
      }),
    ]);
  });
});
