import { act, fireEvent, render } from "@testing-library/react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BrowserScreen } from "@/browser/BrowserScreen";
import { NOSTROOTS_BROWSER_USER_AGENT, NOSTROOTS_WEB_URL } from "@/constants";
import { ROUTES } from "@/constants/routes";

const mockUseRouter = useRouter as jest.Mock;

function renderBrowserScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      }}
    >
      <BrowserScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockUseRouter.mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  });
});

describe("BrowserScreen", () => {
  it("loads Nostroots web with NIP-07 and notification injections", () => {
    const { getByLabelText, getByTestId, getByText } = renderBrowserScreen();
    const webView = getByTestId("nostroots-webview");

    expect(getByTestId("browser-header")).toBeTruthy();
    expect(getByText("Nostroots")).toBeTruthy();
    expect(getByLabelText("Close NIP-07 Browser")).toBeTruthy();
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
    expect(webView.props.originWhitelist).toEqual(["*"]);
  });

  it("closes the browser back to the normal map screen", () => {
    const replace = jest.fn();
    mockUseRouter.mockReturnValue({
      push: jest.fn(),
      replace,
      back: jest.fn(),
    });
    const { getByLabelText } = renderBrowserScreen();

    fireEvent.press(getByLabelText("Close NIP-07 Browser"));

    expect(replace).toHaveBeenCalledWith(ROUTES.HOME);
  });

  it("opens non-HTTP(S) navigation outside the app", () => {
    const { getByTestId } = renderBrowserScreen();
    const webView = getByTestId("nostroots-webview");

    expect(
      webView.props.onShouldStartLoadWithRequest({
        url: "mailto:hello@example.com",
      }),
    ).toBe(false);
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      "mailto:hello@example.com",
    );
  });

  it("allows arbitrary HTTPS navigation and shows the address bar", () => {
    const { getByLabelText, getByTestId } = renderBrowserScreen();
    const webView = getByTestId("nostroots-webview");

    expect(getByLabelText("Developer URL")).toBeTruthy();
    expect(
      webView.props.onShouldStartLoadWithRequest({
        url: "https://example.com/",
      }),
    ).toBe(true);
  });

  it("auto-hides and reveals the developer address bar", () => {
    jest.useFakeTimers();
    const { getByLabelText, queryByLabelText } = renderBrowserScreen();

    expect(getByLabelText("Developer URL")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(queryByLabelText("Developer URL")).toBeNull();
    fireEvent.press(getByLabelText("Show developer address bar"));
    expect(getByLabelText("Developer URL")).toBeTruthy();
  });
});
