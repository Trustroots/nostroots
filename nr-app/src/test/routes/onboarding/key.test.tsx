import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { renderWithProviders } from "@/test/render";
import OnboardingKeyScreen from "../../../../app/onboarding/key";

const mockImportKey = jest.fn(async () => ({
  success: true,
  type: "mnemonic",
}));
const mockClearError = jest.fn();

jest.mock("@/hooks/useKeyImport", () => ({
  useKeyImport: () => ({
    clearError: mockClearError,
    error: null,
    importKey: mockImportKey,
    isImporting: false,
  }),
}));

describe("OnboardingKeyScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("imports an existing key before continuing to legacy link flow", async () => {
    const { router } = renderWithProviders(<OnboardingKeyScreen />);

    fireEvent.press(screen.getByText("Import"));

    fireEvent.changeText(
      screen.getByPlaceholderText("Paste your nsec or mnemonic"),
      "test mnemonic",
    );
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockImportKey).toHaveBeenCalledWith("test mnemonic");
      expect(screen.getByText("Saved")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Continue"));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/onboarding/link");
    });
  });

  it("blocks Continue until the generated words survive the spot-check", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);

    const { router } = renderWithProviders(<OnboardingKeyScreen />);

    const generatedWords = screen
      .getByTestId("onboarding-key-mnemonic-input")
      .props.value.split(" ");

    fireEvent.press(screen.getByText("I have saved these words safely"));

    // The words are hidden while they are being checked.
    expect(screen.queryByTestId("onboarding-key-mnemonic-input")).toBeNull();

    fireEvent.changeText(
      screen.getByTestId("onboarding-key-backup-word-1"),
      "wrong",
    );
    fireEvent.changeText(
      screen.getByTestId("onboarding-key-backup-word-2"),
      generatedWords[1],
    );
    fireEvent.changeText(
      screen.getByTestId("onboarding-key-backup-word-3"),
      generatedWords[2],
    );
    fireEvent.press(screen.getByText("Confirm backup"));

    fireEvent.press(screen.getByText("Continue"));
    expect(router.push).not.toHaveBeenCalled();

    fireEvent.changeText(
      screen.getByTestId("onboarding-key-backup-word-1"),
      generatedWords[0],
    );
    fireEvent.press(screen.getByText("Confirm backup"));

    await waitFor(() => {
      expect(screen.getByText("Backup confirmed.")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Continue"));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/onboarding/link");
    });
  });

  it("goes back to identity when there is no router history", () => {
    const { router } = renderWithProviders(<OnboardingKeyScreen />);

    fireEvent.press(screen.getByText("Back"));

    expect(router.dismissTo).toHaveBeenCalledWith("/onboarding/identity");
  });
});
