import { fireEvent, screen } from "@testing-library/react-native";

import { ROUTES } from "@/constants/routes";
import { keystoreSlice } from "@/redux/slices/keystore.slice";
import { settingsSlice } from "@/redux/slices/settings.slice";
import { renderWithProviders } from "@/test/render";
import OnboardingLinkScreen from "./link";

const mockQueryProfile = jest.fn();

jest.mock("nostr-tools", () => ({
  ...jest.requireActual("nostr-tools"),
  nip05: {
    queryProfile: mockQueryProfile,
  },
}));

jest.mock("@/services/trustrootsProfile.service", () => ({
  publishTrustrootsProfile: jest.fn(async () => undefined),
}));

describe("OnboardingLinkScreen", () => {
  const publicKeyHex = "1".repeat(64);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows an error when NIP-05 verification fails", async () => {
    mockQueryProfile.mockResolvedValue({
      pubkey: publicKeyHex,
      relays: [],
    });
    const { router } = renderWithProviders(<OnboardingLinkScreen />, {
      preloadedState: {
        keystore: {
          ...keystoreSlice.getInitialState(),
          hasPrivateKeyHexInSecureStorage: true,
          publicKeyHex,
          publicKeyNpub:
            "npub1zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygse4sl3h",
        },
        settings: {
          ...settingsSlice.getInitialState(),
          keyWasImported: true,
        },
      },
    });

    fireEvent.changeText(
      screen.getByPlaceholderText("Enter your Trustroots username"),
      "alice",
    );
    fireEvent.press(screen.getByText("Verify"));

    expect(await screen.findByText("Try Again")).toBeTruthy();
    expect(
      screen.getByText(
        "We could not confirm your Trustroots identity via NIP-05 for this key. Ensure your Trustroots profile is configured and try again.",
      ),
    ).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalledWith(ROUTES.HOME);
  });

  it("disables verification when no key is available", () => {
    renderWithProviders(<OnboardingLinkScreen />);

    expect(
      screen.getByText("Nostr key not found on this device."),
    ).toBeTruthy();
    expect(screen.getByText("Verify")).toBeDisabled();
  });
});
