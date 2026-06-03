import {
  act,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { Alert, Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { generatePrivateKey } from "@/nostr/keystore";
import { KeySetupScreen } from "@/screens/key-setup-screen";

jest.mock("@/nostr/keystore", () => ({
  generatePrivateKey: jest.fn(async () => ({
    mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    publicKeyHex: "1".repeat(64),
  })),
  importPrivateKey: jest.fn(),
}));

describe("KeySetupScreen", () => {
  function renderKeySetupScreen(onKeyReady: () => void) {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, right: 0, bottom: 34, left: 0 },
        }}
      >
        <KeySetupScreen onKeyReady={onKeyReady} />
      </SafeAreaProvider>,
    );
  }

  it("can generate and save a new key", async () => {
    const onKeyReady = jest.fn();
    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByLabelText, getByText } = renderKeySetupScreen(onKeyReady);

    expect(
      getByText(
        /Nostroots rebuilds Trustroots on open protocols so travelers and hosts keep control/,
      ),
    ).toBeTruthy();
    expect(getByText("New key")).toBeTruthy();
    expect(getByText("Import existing key")).toBeTruthy();

    fireEvent.press(getByLabelText("Generate new key"));
    const createAction = alertSpy.mock.calls[0]?.[2]?.find(
      (action) => action.text === "Create key",
    );
    await act(async () => {
      await createAction?.onPress?.();
    });

    await waitFor(() => {
      expect(generatePrivateKey).toHaveBeenCalled();
      expect(onKeyReady).toHaveBeenCalled();
    });

    alertSpy.mockRestore();
  });

  it("opens Trustroots signup from the intro copy", () => {
    const openUrlSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const { getByText } = renderKeySetupScreen(jest.fn());

    fireEvent.press(getByText("Sign up first."));

    expect(openUrlSpy).toHaveBeenCalledWith(
      "https://www.trustroots.org/signup",
    );

    openUrlSpy.mockRestore();
  });
});
