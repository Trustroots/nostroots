import { act, fireEvent, render } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BrowserScreen } from "@/browser/BrowserScreen";
import { NOSTROOTS_BROWSER_USER_AGENT, NOSTROOTS_WEB_URL } from "@/constants";

function renderBrowserScreen(developerMode: boolean) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      }}
    >
      <BrowserScreen developerMode={developerMode} />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe("BrowserScreen", () => {
  it("loads Nostroots web with NIP-07 and notification injections", () => {
    const { getByLabelText, getByTestId, getByText } =
      renderBrowserScreen(false);
    const webView = getByTestId("nostroots-webview");

    expect(getByTestId("browser-header")).toBeTruthy();
    expect(getByText("Nostroots")).toBeTruthy();
    expect(getByLabelText("Browser settings")).toBeTruthy();
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
    const { getByTestId } = renderBrowserScreen(false);
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

  it("allows arbitrary navigation and shows the address bar in dev mode", () => {
    const { getByLabelText, getByTestId } = renderBrowserScreen(true);
    const webView = getByTestId("nostroots-webview");

    expect(getByLabelText("Developer URL")).toBeTruthy();
    expect(webView.props.originWhitelist).toEqual(["*"]);
    expect(
      webView.props.onShouldStartLoadWithRequest({
        url: "https://example.com/",
      }),
    ).toBe(true);
  });

  it("auto-hides and reveals the developer address bar", () => {
    jest.useFakeTimers();
    const { getByLabelText, queryByLabelText } = renderBrowserScreen(true);

    expect(getByLabelText("Developer URL")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(queryByLabelText("Developer URL")).toBeNull();
    fireEvent.press(getByLabelText("Show developer address bar"));
    expect(getByLabelText("Developer URL")).toBeTruthy();
  });
});
