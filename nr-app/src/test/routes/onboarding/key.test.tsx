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

  it("goes back to identity when there is no router history", () => {
    const { router } = renderWithProviders(<OnboardingKeyScreen />);

    fireEvent.press(screen.getByText("Back"));

    expect(router.dismissTo).toHaveBeenCalledWith("/onboarding/identity");
  });
});
