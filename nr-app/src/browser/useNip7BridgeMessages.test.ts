import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";
import type { RefObject } from "react";
import type { WebView, WebViewMessageEvent } from "react-native-webview";

import { NIP7_BRIDGE_SOURCE } from "@/browser/nip7-bridge";
import { rememberOrigin } from "@/browser/permission-store";
import { useNip7BridgeMessages } from "@/browser/useNip7BridgeMessages";

jest.mock("@/nostr/keystore.nostr", () => ({
  getPublicKeyHexStringFromSecureStorage: jest.fn(async () => "a".repeat(64)),
  signEventTemplate: jest.fn(),
  nip44Encrypt: jest.fn(),
  nip44Decrypt: jest.fn(),
  nip04Encrypt: jest.fn(),
  nip04Decrypt: jest.fn(),
}));

function bridgeRequest(method: string, id = "req-1") {
  return JSON.stringify({
    source: NIP7_BRIDGE_SOURCE,
    id,
    method,
    params: method === "getPublicKey" ? [] : undefined,
  });
}

function makeMessage(
  rawMessage: string,
  url = "https://example.com/",
): WebViewMessageEvent {
  return {
    nativeEvent: { data: rawMessage, url },
  } as WebViewMessageEvent;
}

function createRefs(url = "https://example.com/") {
  const injectJavaScript = jest.fn();
  const webViewRef = {
    current: { injectJavaScript },
  } as unknown as RefObject<WebView>;
  const currentUrlRef = { current: url };
  return { webViewRef, currentUrlRef, injectJavaScript };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe("useNip7BridgeMessages", () => {
  it("ignores non-bridge postMessage payloads", async () => {
    const { webViewRef, currentUrlRef, injectJavaScript } = createRefs();
    const { result } = renderHook(() =>
      useNip7BridgeMessages(webViewRef, currentUrlRef),
    );

    await act(async () => {
      await result.current.handleMessage(
        makeMessage(JSON.stringify({ foo: "bar" })),
      );
    });

    expect(injectJavaScript).not.toHaveBeenCalled();
    expect(result.current.permissionPrompt).toBeNull();
  });

  it("denies unknown NIP-07 methods without opening a prompt", async () => {
    const { webViewRef, currentUrlRef, injectJavaScript } = createRefs();
    const { result } = renderHook(() =>
      useNip7BridgeMessages(webViewRef, currentUrlRef),
    );

    await act(async () => {
      await result.current.handleMessage(
        makeMessage(
          JSON.stringify({
            source: NIP7_BRIDGE_SOURCE,
            id: "unknown-1",
            method: "signSchnorr",
          }),
        ),
      );
    });

    expect(injectJavaScript).toHaveBeenCalled();
    expect(injectJavaScript.mock.calls[0][0]).toContain("unknown-1");
    expect(result.current.permissionPrompt).toBeNull();
  });

  it("auto-allows trusted origins without a prompt", async () => {
    const { webViewRef, currentUrlRef, injectJavaScript } = createRefs(
      "https://nos.trustroots.org/",
    );
    const { result } = renderHook(() =>
      useNip7BridgeMessages(webViewRef, currentUrlRef),
    );

    await act(async () => {
      await result.current.handleMessage(
        makeMessage(
          bridgeRequest("getPublicKey"),
          "https://nos.trustroots.org/",
        ),
      );
    });

    expect(injectJavaScript).toHaveBeenCalled();
    expect(result.current.permissionPrompt).toBeNull();
  });

  it("auto-allows trusted origins for signing", async () => {
    const { webViewRef, currentUrlRef, injectJavaScript } = createRefs(
      "https://nos.trustroots.org/",
    );
    const { result } = renderHook(() =>
      useNip7BridgeMessages(webViewRef, currentUrlRef),
    );

    await act(async () => {
      await result.current.handleMessage(
        makeMessage(bridgeRequest("signEvent"), "https://nos.trustroots.org/"),
      );
    });

    expect(injectJavaScript).toHaveBeenCalled();
    expect(result.current.permissionPrompt).toBeNull();
  });

  it("skips the modal for remembered origin methods", async () => {
    await rememberOrigin("https://example.com", "getPublicKey");
    const { webViewRef, currentUrlRef, injectJavaScript } = createRefs();
    const { result } = renderHook(() =>
      useNip7BridgeMessages(webViewRef, currentUrlRef),
    );

    await act(async () => {
      await result.current.handleMessage(
        makeMessage(bridgeRequest("getPublicKey")),
      );
    });

    expect(injectJavaScript).toHaveBeenCalled();
    expect(result.current.permissionPrompt).toBeNull();
  });

  it("does not reuse a remembered pubkey permission for signing", async () => {
    await rememberOrigin("https://example.com", "getPublicKey");
    const { webViewRef, currentUrlRef, injectJavaScript } = createRefs();
    const { result } = renderHook(() =>
      useNip7BridgeMessages(webViewRef, currentUrlRef),
    );

    await act(async () => {
      await result.current.handleMessage(
        makeMessage(bridgeRequest("signEvent")),
      );
    });

    expect(result.current.permissionPrompt).toEqual({
      origin: "https://example.com",
      host: "example.com",
      method: "signEvent",
    });
    expect(injectJavaScript).not.toHaveBeenCalled();
  });

  it("uses the message event URL instead of a stale current URL ref", async () => {
    const { webViewRef, currentUrlRef, injectJavaScript } = createRefs(
      "https://nos.trustroots.org/",
    );
    const { result } = renderHook(() =>
      useNip7BridgeMessages(webViewRef, currentUrlRef),
    );

    await act(async () => {
      await result.current.handleMessage(
        makeMessage(bridgeRequest("getPublicKey"), "https://example.com/"),
      );
    });

    expect(result.current.permissionPrompt).toEqual({
      origin: "https://example.com",
      host: "example.com",
      method: "getPublicKey",
    });
    expect(injectJavaScript).not.toHaveBeenCalled();
  });

  it("queues a permission prompt for unknown origins", async () => {
    const { webViewRef, currentUrlRef, injectJavaScript } = createRefs();
    const { result } = renderHook(() =>
      useNip7BridgeMessages(webViewRef, currentUrlRef),
    );

    await act(async () => {
      await result.current.handleMessage(
        makeMessage(bridgeRequest("getPublicKey")),
      );
    });

    expect(result.current.permissionPrompt).toEqual({
      origin: "https://example.com",
      host: "example.com",
      method: "getPublicKey",
    });
    expect(injectJavaScript).not.toHaveBeenCalled();
  });

  it("responds to pending messages after allow", async () => {
    const { webViewRef, currentUrlRef, injectJavaScript } = createRefs();
    const { result } = renderHook(() =>
      useNip7BridgeMessages(webViewRef, currentUrlRef),
    );

    await act(async () => {
      await result.current.handleMessage(
        makeMessage(bridgeRequest("getPublicKey")),
      );
    });

    await act(async () => {
      await result.current.allowPrompt(false);
    });

    expect(injectJavaScript).toHaveBeenCalled();
    expect(result.current.permissionPrompt).toBeNull();
  });

  it("only releases the allowed method when multiple prompts are pending", async () => {
    const { webViewRef, currentUrlRef, injectJavaScript } = createRefs();
    const { result } = renderHook(() =>
      useNip7BridgeMessages(webViewRef, currentUrlRef),
    );

    await act(async () => {
      await result.current.handleMessage(
        makeMessage(bridgeRequest("getPublicKey", "pubkey-1")),
      );
      await result.current.handleMessage(
        makeMessage(bridgeRequest("signEvent", "sign-1")),
      );
    });

    await act(async () => {
      await result.current.allowPrompt(true);
    });

    expect(injectJavaScript).toHaveBeenCalledTimes(1);
    expect(injectJavaScript.mock.calls[0][0]).toContain("pubkey-1");
    expect(result.current.permissionPrompt).toEqual({
      origin: "https://example.com",
      host: "example.com",
      method: "signEvent",
    });
  });

  it("denies pending messages when the prompt is rejected", async () => {
    const { webViewRef, currentUrlRef, injectJavaScript } = createRefs();
    const { result } = renderHook(() =>
      useNip7BridgeMessages(webViewRef, currentUrlRef),
    );

    await act(async () => {
      await result.current.handleMessage(
        makeMessage(bridgeRequest("getPublicKey", "deny-me")),
      );
    });

    await act(() => {
      result.current.denyPrompt();
    });

    expect(injectJavaScript).toHaveBeenCalled();
    expect(injectJavaScript.mock.calls[0][0]).toContain("deny-me");
    expect(result.current.permissionPrompt).toBeNull();
  });

  it("denies pending messages when navigation changes origin", async () => {
    const { webViewRef, currentUrlRef, injectJavaScript } = createRefs();
    const { result } = renderHook(() =>
      useNip7BridgeMessages(webViewRef, currentUrlRef),
    );

    await act(async () => {
      await result.current.handleMessage(
        makeMessage(bridgeRequest("getPublicKey", "nav-deny")),
      );
    });

    await act(() => {
      result.current.handleNavigationUrlChange("https://other.example/");
    });

    expect(injectJavaScript).toHaveBeenCalled();
    expect(injectJavaScript.mock.calls[0][0]).toContain("nav-deny");
    expect(result.current.permissionPrompt).toBeNull();
  });
});
