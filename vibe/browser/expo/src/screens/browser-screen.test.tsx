import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  NOSTROOTS_BROWSER_USER_AGENT,
  NOSTROOTS_WEB_URL,
  SECURE_STORE_DEVELOPER_MODE_KEY,
} from "@/constants";
import { rememberOrigin } from "@/nostr/permission-store";
import { BrowserScreen } from "@/screens/browser-screen";

function renderBrowserScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      }}
    >
      <BrowserScreen onKeyCleared={jest.fn()} />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  (SecureStore as unknown as { __reset: () => void }).__reset();
  jest.clearAllMocks();
});

describe("BrowserScreen", () => {
  it("loads Nostroots web with NIP-07 and notification injections", () => {
    const { getByLabelText, getByTestId, getByText } = renderBrowserScreen();
    const header = getByTestId("browser-header");
    const webView = getByTestId("nostroots-webview");

    expect(header.props.style).toMatchObject({ height: 86, paddingTop: 14 });
    expect(getByText("Nostroots")).toBeTruthy();
    expect(getByLabelText("Settings")).toBeTruthy();
    expect(webView.props.source).toEqual({ uri: NOSTROOTS_WEB_URL });
    expect(webView.props.applicationNameForUserAgent).toBe(
      NOSTROOTS_BROWSER_USER_AGENT,
    );
    expect(webView.props.injectedJavaScriptBeforeContentLoaded).toContain(
      "window.nostr",
    );
    expect(webView.props.injectedJavaScriptBeforeContentLoaded).toContain(
      "window.nostrootsBrowser.notifications",
    );
  });

  it("opens blocked external navigation outside the app", () => {
    const { getByTestId } = renderBrowserScreen();
    const webView = getByTestId("nostroots-webview");

    expect(
      webView.props.onShouldStartLoadWithRequest({
        url: "https://example.com/",
      }),
    ).toBe(false);
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      "https://example.com/",
    );
  });

  it("persists developer mode and allows arbitrary navigation", async () => {
    await act(async () => {
      await SecureStore.setItemAsync(SECURE_STORE_DEVELOPER_MODE_KEY, "true");
    });
    const { getByLabelText, getByTestId } = renderBrowserScreen();

    const webView = getByTestId("nostroots-webview");
    await waitFor(() => {
      expect(getByLabelText("Developer URL")).toBeTruthy();
    });
    await expect(
      SecureStore.getItemAsync(SECURE_STORE_DEVELOPER_MODE_KEY),
    ).resolves.toBe("true");
    expect(webView.props.originWhitelist).toEqual(["*"]);
    expect(
      webView.props.onShouldStartLoadWithRequest({
        url: "https://example.com/",
      }),
    ).toBe(true);
  });

  it("renders remembered NIP-07 origins in settings", async () => {
    await rememberOrigin("https://example.com");
    const { findByText, getByLabelText } = renderBrowserScreen();

    fireEvent.press(getByLabelText("Settings"));

    expect(await findByText("NIP-07 access")).toBeTruthy();
    expect(await findByText("example.com")).toBeTruthy();
    expect(await findByText("Always allowed")).toBeTruthy();
  });
});
