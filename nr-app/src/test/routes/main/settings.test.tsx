import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { settingsSlice } from "@/redux/slices/settings.slice";
import { renderWithProviders } from "@/test/render";
import SettingsScreen from "../../../../app/(main)/(views)/settings";

const mockImportKey = jest.fn(async () => ({
  success: true,
  type: "mnemonic",
}));

jest.mock("@/hooks/useKeyImport", () => ({
  useKeyImport: () => ({
    clearError: jest.fn(),
    error: null,
    importKey: mockImportKey,
    isImporting: false,
  }),
}));

describe("SettingsScreen", () => {
  it("renders notification, import key, appearance, and help sections", () => {
    renderWithProviders(<SettingsScreen />);

    expect(screen.getByText("Notifications")).toBeTruthy();
    expect(screen.getAllByText("Import Key").length).toBeGreaterThan(0);
    expect(screen.getByText("Appearance")).toBeTruthy();
    expect(screen.getByText("Help")).toBeTruthy();
  });

  it("updates color scheme preference", () => {
    const { store } = renderWithProviders(<SettingsScreen />);

    fireEvent.press(screen.getByText("Dark"));

    expect(store.getState().settings.colorScheme).toBe("dark");
  });

  it("shows test feature controls when enabled", async () => {
    renderWithProviders(<SettingsScreen />, {
      preloadedState: {
        settings: {
          ...settingsSlice.getInitialState(),
          areTestFeaturesEnabled: true,
        },
      },
    });

    expect(screen.getByText("Notification Debug")).toBeTruthy();
    expect(screen.getByText("Set visible plus codes")).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.getByText("No websites have used NIP-07 yet."),
      ).toBeTruthy();
    });
  });
});
