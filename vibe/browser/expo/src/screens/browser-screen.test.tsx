import { fireEvent, render } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  NOSTROOTS_BROWSER_USER_AGENT,
  NOSTROOTS_WEB_URL,
} from "@/constants";
import {
  BrowserScreen,
  normalizeDeveloperUrl,
  shouldAllowNostrootsNavigation,
} from "@/screens/browser-screen";

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

describe("BrowserScreen", () => {
  it("loads Nostroots web with the NIP-07 injection script", () => {
    const { getByLabelText, getByTestId, getByText } = renderBrowserScreen();
    const topSpacer = getByTestId("browser-top-spacer");
    const webView = getByTestId("nostroots-webview");
    const settingsButton = getByLabelText("Settings");

    expect(topSpacer.props.style).toMatchObject({ height: 47 });
    expect(getByText("Nostroots Browser")).toBeTruthy();
    expect(webView.props.source).toEqual({ uri: NOSTROOTS_WEB_URL });
    expect(webView.props.style).toMatchObject({ flex: 1 });
    expect(settingsButton.props.style).toMatchObject({ top: 12, right: 28 });
    expect(webView.props.applicationNameForUserAgent).toBe(
      NOSTROOTS_BROWSER_USER_AGENT,
    );
    expect(webView.props.injectedJavaScriptBeforeContentLoaded).toContain(
      "window.nostr",
    );
  });

  it("allows only Nostroots navigation", () => {
    expect(shouldAllowNostrootsNavigation("https://nos.trustroots.org/")).toBe(
      true,
    );
    expect(
      shouldAllowNostrootsNavigation("https://nos.trustroots.org/#settings"),
    ).toBe(true);
    expect(shouldAllowNostrootsNavigation("https://example.com/")).toBe(false);
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

  it("normalizes developer URLs", () => {
    expect(normalizeDeveloperUrl("example.com")).toBe("https://example.com");
    expect(normalizeDeveloperUrl("http://example.com")).toBe(
      "http://example.com",
    );
    expect(normalizeDeveloperUrl("   ")).toBe(NOSTROOTS_WEB_URL);
  });

  it("allows arbitrary navigation when developer mode is enabled", () => {
    const { getByLabelText, getByTestId } = renderBrowserScreen();

    fireEvent.press(getByLabelText("Settings"));
    fireEvent(getByLabelText("Developer mode"), "valueChange", true);
    fireEvent.press(getByLabelText("Done"));

    const webView = getByTestId("nostroots-webview");

    expect(getByLabelText("Developer URL")).toBeTruthy();
    expect(webView.props.originWhitelist).toEqual(["*"]);
    expect(
      webView.props.onShouldStartLoadWithRequest({
        url: "https://example.com/",
      }),
    ).toBe(true);
  });

  it("opens settings from the top-right button", async () => {
    const { findByText, getByLabelText, getByText } = renderBrowserScreen();

    fireEvent.press(getByLabelText("Settings"));

    expect(getByText("Settings")).toBeTruthy();
    expect(getByText("Developer mode")).toBeTruthy();
    expect(getByText("Build time")).toBeTruthy();
    expect(getByText("2026-06-02 15:04")).toBeTruthy();
    expect(getByText("Key")).toBeTruthy();
    await findByText("No Nostroots Browser key is available.");
  });
});
