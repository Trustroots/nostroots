import { fireEvent, screen } from "@testing-library/react-native";

import { ROUTES } from "@/constants/routes";
import { keystoreSlice } from "@/redux/slices/keystore.slice";
import { settingsSlice } from "@/redux/slices/settings.slice";
import { renderWithProviders } from "@/test/render";
import OnboardingLinkScreen from "../../../../app/onboarding/link";

jest.mock("nostr-tools", () => ({
  ...jest.requireActual("nostr-tools"),
  nip05: {
    ...jest.requireActual("nostr-tools").nip05,
    queryProfile: jest.fn(),
  },
}));

const mockQueryProfile = jest.requireMock("nostr-tools").nip05
  .queryProfile as jest.Mock;

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
      pubkey: "2".repeat(64),
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
      screen.getByText(/npub returned by Trustroots does not match/),
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
