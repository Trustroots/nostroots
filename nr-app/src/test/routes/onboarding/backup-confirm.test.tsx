import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { setPrivateKeyInSecureStorage } from "@/nostr/keystore.nostr";
import { settingsSlice } from "@/redux/slices/settings.slice";
import { renderWithProviders } from "@/test/render";
import { resetSecureStoreMock } from "@/test/secureStoreMock";
import OnboardingBackupConfirmScreen from "../../../../app/onboarding/backup-confirm";

const mnemonic =
  "romance slim fame pipe puzzle priority actress must impulse tape super bike";

const words = mnemonic.split(" ");

describe("OnboardingBackupConfirmScreen", () => {
  beforeEach(() => {
    resetSecureStoreMock();
    // Makes the challenge ask for words 1, 2 and 3.
    jest.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  async function revealSecret() {
    await setPrivateKeyInSecureStorage({ mnemonic });

    const rendered = renderWithProviders(<OnboardingBackupConfirmScreen />, {
      preloadedState: {
        settings: {
          ...settingsSlice.getInitialState(),
          keyWasImported: false,
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("onboarding-backup-secret")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("I have saved my secret"));

    return rendered;
  }

  it("hides the secret once it is acknowledged", async () => {
    await revealSecret();

    expect(screen.queryByTestId("onboarding-backup-secret")).toBeNull();
    expect(screen.getByTestId("onboarding-backup-word-1")).toBeTruthy();
  });

  it("rejects wrong words and keeps Finish disabled", async () => {
    const { router } = await revealSecret();

    words.slice(0, 3).forEach((_, index) => {
      fireEvent.changeText(
        screen.getByTestId(`onboarding-backup-word-${index + 1}`),
        "wrong",
      );
    });
    fireEvent.press(screen.getByText("Confirm backup"));

    expect(
      screen.getByText(
        "That does not match your backup. Check the numbered words and try again.",
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByText("Finish"));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("confirms a generated mnemonic backup by its numbered words", async () => {
    const { router } = await revealSecret();

    words.slice(0, 3).forEach((word, index) => {
      fireEvent.changeText(
        screen.getByTestId(`onboarding-backup-word-${index + 1}`),
        word,
      );
    });
    fireEvent.press(screen.getByText("Confirm backup"));

    await waitFor(() => {
      expect(screen.getByText("Backup confirmed.")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Finish"));

    expect(router.replace).toHaveBeenCalledWith("/(main)/(map)");
  });

  it("lets the user reveal the same secret again before confirming", async () => {
    await revealSecret();

    fireEvent.changeText(
      screen.getByTestId("onboarding-backup-word-1"),
      "wrong",
    );
    fireEvent.press(screen.getByText("Show my secret again"));

    expect(screen.getByTestId("onboarding-backup-secret")).toHaveTextContent(
      mnemonic,
    );

    fireEvent.press(screen.getByText("I have saved my secret"));

    expect(screen.getByTestId("onboarding-backup-word-1").props.value).toBe("");
  });

  it("hides the show-again action once the backup is confirmed", async () => {
    await revealSecret();

    words.slice(0, 3).forEach((word, index) => {
      fireEvent.changeText(
        screen.getByTestId(`onboarding-backup-word-${index + 1}`),
        word,
      );
    });
    fireEvent.press(screen.getByText("Confirm backup"));

    await waitFor(() => {
      expect(screen.getByText("Backup confirmed.")).toBeTruthy();
    });
    expect(screen.queryByText("Show my secret again")).toBeNull();
  });

  it("names each answer field by its word position", async () => {
    await revealSecret();

    expect(screen.getByLabelText("Word 1")).toBe(
      screen.getByTestId("onboarding-backup-word-1"),
    );
    expect(screen.getByLabelText("Word 3")).toBeTruthy();
  });

  it("asks for the whole nsec when only a hex key is stored, and names the field", async () => {
    await setPrivateKeyInSecureStorage({ privateKeyHex: "1".repeat(64) });
    renderWithProviders(<OnboardingBackupConfirmScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("onboarding-backup-secret")).toBeTruthy();
    });
    const nsec = screen.getByTestId("onboarding-backup-secret").props.children;
    fireEvent.press(screen.getByText("I have saved my secret"));

    expect(screen.getByLabelText("Your full secret")).toBe(
      screen.getByTestId("onboarding-backup-secret"),
    );
    fireEvent.changeText(screen.getByLabelText("Your full secret"), nsec);
    fireEvent.press(screen.getByText("Confirm backup"));

    await waitFor(() => {
      expect(screen.getByText("Backup confirmed.")).toBeTruthy();
    });
  });
});
