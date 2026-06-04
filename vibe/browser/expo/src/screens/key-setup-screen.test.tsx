import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { generatePrivateKey, importPrivateKey } from "@/nostr/keystore";
import { KeySetupScreen } from "@/screens/key-setup-screen";

jest.mock("@/nostr/keystore", () => ({
  generatePrivateKey: jest.fn(async () => ({
    mnemonic:
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    publicKeyHex: "1".repeat(64),
  })),
  importPrivateKey: jest.fn(async () => ({
    publicKeyHex: "1".repeat(64),
    type: "mnemonic",
  })),
}));

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

describe("KeySetupScreen", () => {
  it("can generate and save a new mnemonic-backed key", async () => {
    const onKeyReady = jest.fn();
    const { getByLabelText, getByText } = renderKeySetupScreen(onKeyReady);

    expect(
      getByText(
        /Nostroots rebuilds Trustroots on open protocols, so travelers and hosts keep control/,
      ),
    ).toBeTruthy();
    expect(getByText("New key")).toBeTruthy();
    expect(getByText("Import existing key")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByLabelText("Generate new key"));
    });

    await waitFor(() => {
      expect(generatePrivateKey).toHaveBeenCalled();
      expect(onKeyReady).toHaveBeenCalled();
    });
  });

  it("can import an existing key", async () => {
    const onKeyReady = jest.fn();
    const { getByLabelText } = renderKeySetupScreen(onKeyReady);

    fireEvent.changeText(getByLabelText("Private key or recovery phrase"), "nsec1abc");
    await act(async () => {
      fireEvent.press(getByLabelText("Import key"));
    });

    await waitFor(() => {
      expect(importPrivateKey).toHaveBeenCalledWith("nsec1abc");
      expect(onKeyReady).toHaveBeenCalled();
    });
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
