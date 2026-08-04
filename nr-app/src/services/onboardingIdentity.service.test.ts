import { nip19 } from "nostr-tools";

import { setPrivateKeyPromiseAction } from "@/redux/sagas/keystore.saga";
import { setPublicKeyHex } from "@/redux/slices/keystore.slice";
import { settingsActions } from "@/redux/slices/settings.slice";
import { ensureOnboardingIdentity } from "./onboardingIdentity.service";

jest.mock("@/nostr/keystore.nostr", () => ({
  derivePublicKeyHexFromMnemonic: jest.fn(() => "2".repeat(64)),
  getPublicKeyHexFromSecureStorage: jest.fn(),
}));

jest.mock("nip06", () => ({
  generateSeedWords: jest.fn(() => ({ mnemonic: "test seed words" })),
}));

const keystore = jest.requireMock("@/nostr/keystore.nostr") as {
  getPublicKeyHexFromSecureStorage: jest.Mock;
};

describe("onboardingIdentity.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a stored identity and syncs it into Redux", async () => {
    const publicKeyHex = "1".repeat(64);
    const dispatch = jest.fn();

    keystore.getPublicKeyHexFromSecureStorage.mockResolvedValue({
      hasMnemonicInSecureStorage: true,
      publicKeyHex,
    });

    await expect(ensureOnboardingIdentity(dispatch)).resolves.toEqual({
      npub: nip19.npubEncode(publicKeyHex),
      publicKeyHex,
      wasGenerated: false,
    });

    expect(dispatch).toHaveBeenCalledWith(
      setPublicKeyHex({
        hasMnemonic: true,
        publicKeyHex,
      }),
    );
  });

  it("generates and stores a new identity when none exists", async () => {
    const dispatch = jest.fn(async () => undefined);
    const publicKeyHex = "2".repeat(64);

    keystore.getPublicKeyHexFromSecureStorage.mockResolvedValue(undefined);

    await expect(ensureOnboardingIdentity(dispatch)).resolves.toEqual({
      npub: nip19.npubEncode(publicKeyHex),
      publicKeyHex,
      wasGenerated: true,
    });

    expect(dispatch).toHaveBeenCalledWith(
      setPrivateKeyPromiseAction.request({ mnemonic: "test seed words" }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      settingsActions.setKeyWasImported(false),
    );
  });
});
