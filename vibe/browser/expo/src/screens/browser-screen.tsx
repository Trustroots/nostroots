import Ionicons from "@expo/vector-icons/Ionicons";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, {
  WebViewMessageEvent,
  WebViewNavigation,
} from "react-native-webview";

import {
  NOSTROOTS_BROWSER_USER_AGENT,
  NOSTROOTS_WEB_ORIGIN,
  NOSTROOTS_WEB_URL,
} from "@/constants";
import {
  getPublicKeyHexFromSecureStorage,
  nip04Decrypt,
  nip04Encrypt,
  nip44Decrypt,
  nip44Encrypt,
  signEventTemplate,
} from "@/nostr/keystore";
import {
  createNip7InjectionScript,
  createNip7ResponseScript,
  handleNip7BridgeMessage,
} from "@/nostr/nip7-bridge";
import { KeyDetailsScreen } from "@/screens/key-details-screen";

interface BrowserScreenProps {
  onKeyCleared: () => void;
}

function isAllowedUrl(url: string): boolean {
  try {
    return new URL(url).origin === NOSTROOTS_WEB_ORIGIN;
  } catch {
    return false;
  }
}

export function shouldAllowNostrootsNavigation(url: string): boolean {
  return isAllowedUrl(url);
}

export function normalizeDeveloperUrl(input: string): string {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return NOSTROOTS_WEB_URL;
  }

  if (/^https?:\/\//i.test(trimmedInput)) {
    return trimmedInput;
  }

  return `https://${trimmedInput}`;
}

export function BrowserScreen({ onKeyCleared }: BrowserScreenProps) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [isShowingKeyDetails, setIsShowingKeyDetails] = useState(false);
  const [isDeveloperModeEnabled, setIsDeveloperModeEnabled] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>(NOSTROOTS_WEB_URL);
  const [addressInput, setAddressInput] = useState<string>(NOSTROOTS_WEB_URL);

  const handleMessage = async (event: WebViewMessageEvent) => {
    const response = await handleNip7BridgeMessage(event.nativeEvent.data, {
      getPublicKey: getPublicKeyHexFromSecureStorage,
      signEvent: signEventTemplate,
      nip44Encrypt,
      nip44Decrypt,
      nip04Encrypt,
      nip04Decrypt,
    });
    webViewRef.current?.injectJavaScript(createNip7ResponseScript(response));
  };

  const handleShouldStartLoadWithRequest = (request: { url: string }) => {
    if (isDeveloperModeEnabled) {
      return true;
    }

    if (shouldAllowNostrootsNavigation(request.url)) {
      return true;
    }

    WebBrowser.openBrowserAsync(request.url);
    return false;
  };

  const handleNavigationStateChange = (navigationState: WebViewNavigation) => {
    if (!navigationState.url) return;
    setCurrentUrl(navigationState.url);
    setAddressInput(navigationState.url);
  };

  const handleDeveloperGo = () => {
    setCurrentUrl(normalizeDeveloperUrl(addressInput));
  };

  if (isShowingKeyDetails) {
    return (
      <KeyDetailsScreen
        isDeveloperModeEnabled={isDeveloperModeEnabled}
        onClose={() => setIsShowingKeyDetails(false)}
        onDeveloperModeChange={setIsDeveloperModeEnabled}
        onKeyCleared={onKeyCleared}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#12a585" }}>
      <View
        testID="browser-top-spacer"
        style={{
          height: insets.top,
          backgroundColor: "#12a585",
          justifyContent: "flex-end",
          paddingBottom: 11,
          paddingLeft: 18,
        }}
      >
        <Text
          style={{
            color: "#ffffff",
            fontSize: 15,
            fontWeight: "800",
          }}
        >
          Nostroots Browser
        </Text>
      </View>
      <WebView
        ref={webViewRef}
        testID="nostroots-webview"
        source={{ uri: currentUrl }}
        applicationNameForUserAgent={NOSTROOTS_BROWSER_USER_AGENT}
        injectedJavaScriptBeforeContentLoaded={createNip7InjectionScript()}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        originWhitelist={isDeveloperModeEnabled ? ["*"] : [NOSTROOTS_WEB_ORIGIN]}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        setSupportMultipleWindows={false}
        style={{ flex: 1 }}
      />
      {isDeveloperModeEnabled ? (
        <View
          style={{
            position: "absolute",
            top: insets.top + 58,
            left: 12,
            right: 12,
            minHeight: 48,
            padding: 6,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "rgba(15, 23, 42, 0.08)",
            backgroundColor: "rgba(255, 255, 255, 0.96)",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <TextInput
            accessibilityLabel="Developer URL"
            value={addressInput}
            onChangeText={setAddressInput}
            onSubmitEditing={handleDeveloperGo}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectTextOnFocus
            style={{
              flex: 1,
              minHeight: 36,
              paddingHorizontal: 10,
              borderRadius: 8,
              backgroundColor: "#f8fafc",
              color: "#0f172a",
              fontSize: 14,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to URL"
            onPress={handleDeveloperGo}
            style={{
              minWidth: 42,
              minHeight: 36,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              backgroundColor: "#12a585",
            }}
          >
            <Text style={{ color: "#ffffff", fontWeight: "700" }}>Go</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => setIsShowingKeyDetails(true)}
        style={{
          position: "absolute",
          top: 12,
          right: 28,
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(255, 255, 255, 0.92)",
          borderWidth: 1,
          borderColor: "rgba(15, 23, 42, 0.08)",
          zIndex: 10,
        }}
      >
        <Ionicons name="settings-outline" size={22} color="#0f172a" />
      </Pressable>
    </View>
  );
}
