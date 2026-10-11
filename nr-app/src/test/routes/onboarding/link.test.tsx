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

const mockTrackEvent = jest.fn();
jest.mock("@/services/analytics.service", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
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

  describe.each([
    { keyWasImported: false, method: "generated_key" },
    { keyWasImported: true, method: "imported_key" },
  ])("Finish after linking ($method)", ({ keyWasImported, method }) => {
    it("goes straight home and tracks completion", async () => {
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
          },
          settings: { ...settingsSlice.getInitialState(), keyWasImported },
        },
      });

      fireEvent.changeText(
        screen.getByPlaceholderText("Enter your Trustroots username"),
        "alice",
      );
      fireEvent.press(screen.getByText("Verify"));
      await screen.findByText("Linked");

      fireEvent.press(screen.getByText("Finish"));

      expect(router.replace).toHaveBeenCalledWith(ROUTES.HOME);
      expect(router.push).not.toHaveBeenCalled();
      expect(mockTrackEvent).toHaveBeenCalledWith("onboarding_completed", {
        method,
      });
    });
  });
});
