import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { settingsSlice } from "@/redux/slices/settings.slice";
import { renderWithProviders } from "@/test/render";
import { resetSecureStoreMock } from "@/test/secureStoreMock";
import { setPrivateKeyInSecureStorage } from "@/nostr/keystore.nostr";
import OnboardingBackupConfirmScreen from "./backup-confirm";

const mnemonic =
  "romance slim fame pipe puzzle priority actress must impulse tape super bike";

describe("OnboardingBackupConfirmScreen", () => {
  beforeEach(() => {
    resetSecureStoreMock();
  });

  it("shows setup error when no key is present", async () => {
    renderWithProviders(<OnboardingBackupConfirmScreen />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "We could not find your key on this device. Please restart onboarding.",
        ),
      ).toBeTruthy();
    });
  });

  it("confirms a generated mnemonic backup", async () => {
    await setPrivateKeyInSecureStorage({ mnemonic });

    const { router } = renderWithProviders(<OnboardingBackupConfirmScreen />, {
      preloadedState: {
        settings: {
          ...settingsSlice.getInitialState(),
          keyWasImported: false,
        },
      },
    });

    await waitFor(() => {
      expect(
        screen.getByText("Save this secret before continuing"),
      ).toBeTruthy();
    });

    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Paste your nsec1... key or type your 12/24-word mnemonic",
      ),
      mnemonic,
    );
    fireEvent.press(screen.getByText("Confirm backup"));

    await waitFor(() => {
      expect(
        screen.getByText("You’re all set — backup confirmed."),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Finish"));

    expect(router.replace).toHaveBeenCalledWith("/(main)/(map)");
  });
});
