import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";

import { renderWithProviders } from "@/test/render";
import OnboardingKeyScreen from "../../../../app/onboarding/key";

const mockImportKey = jest.fn(async () => ({
  success: true,
  type: "mnemonic",
}));
const mockClearError = jest.fn();
const mockDispatch = jest.fn();

jest.mock("@/redux/hooks", () => ({
  ...jest.requireActual("@/redux/hooks"),
  useAppDispatch: () => mockDispatch,
}));

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
    mockDispatch.mockResolvedValue(undefined);
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

  it("waits for a generated key to be saved before navigating", async () => {
    let finishSaving!: () => void;
    mockDispatch.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSaving = resolve;
      }),
    );
    const { router } = renderWithProviders(<OnboardingKeyScreen />);
    fireEvent.press(screen.getByTestId("onboarding-key-tab-generate"));
    fireEvent.press(screen.getByTestId("onboarding-key-mnemonic-confirm"));
    fireEvent.press(screen.getByTestId("onboarding-key-continue"));

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "keystore/setPrivateKey/request",
      }),
    );
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => finishSaving());
    expect(router.push).toHaveBeenCalledWith("/onboarding/link");
  });

  it("stays on the key screen when saving a generated key fails", async () => {
    mockDispatch.mockRejectedValueOnce(new Error("storage full"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { router } = renderWithProviders(<OnboardingKeyScreen />);
    fireEvent.press(screen.getByTestId("onboarding-key-tab-generate"));
    fireEvent.press(screen.getByTestId("onboarding-key-mnemonic-confirm"));
    fireEvent.press(screen.getByTestId("onboarding-key-continue"));

    await waitFor(() => {
      expect(
        screen.getByText("We could not set up this key. Please try again."),
      ).toBeTruthy();
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("goes back to identity when there is no router history", () => {
    const { router } = renderWithProviders(<OnboardingKeyScreen />);

    fireEvent.press(screen.getByText("Back"));

    expect(router.dismissTo).toHaveBeenCalledWith("/onboarding/identity");
  });
});
