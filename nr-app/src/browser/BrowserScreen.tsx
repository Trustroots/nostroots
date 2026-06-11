// This screen is only reachable when Developer Mode is enabled (see browser.tsx
// route guard). It always allows arbitrary HTTPS navigation and shows the
// developer address bar — there is no separate nostroots-only mode in nr-app.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, Switch, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { WebViewNavigation } from "react-native-webview";

import { Text } from "@/components/ui/text";
import { NOSTROOTS_BROWSER_USER_AGENT, NOSTROOTS_WEB_URL } from "@/constants";
import { ROUTES } from "@/constants/routes";
import { createNip7InjectionScript } from "@/browser/nip7-bridge";
import { createNotificationBridgeInjectionScript } from "@/browser/notification-bridge";
import {
  navigationDecision,
  normalizeDeveloperUrl,
} from "@/browser/navigation-policy";
import {
  PermissionPrompt,
  useNip7BridgeMessages,
} from "@/browser/useNip7BridgeMessages";

export function BrowserScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const currentUrlRef = useRef<string>(NOSTROOTS_WEB_URL);
  const addressBarAutoHideRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [isDeveloperAddressBarVisible, setIsDeveloperAddressBarVisible] =
    useState(true);
  const [isDeveloperAddressBarFocused, setIsDeveloperAddressBarFocused] =
    useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>(NOSTROOTS_WEB_URL);
  const [addressInput, setAddressInput] = useState<string>(NOSTROOTS_WEB_URL);
  const {
    permissionPrompt,
    handleMessage,
    handleNavigationUrlChange,
    allowPrompt,
    denyPrompt,
  } = useNip7BridgeMessages(webViewRef, currentUrlRef);

  const clearAddressBarAutoHide = useCallback(() => {
    if (addressBarAutoHideRef.current) {
      clearTimeout(addressBarAutoHideRef.current);
      addressBarAutoHideRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearAddressBarAutoHide();
    if (isDeveloperAddressBarVisible && !isDeveloperAddressBarFocused) {
      addressBarAutoHideRef.current = setTimeout(() => {
        setIsDeveloperAddressBarVisible(false);
      }, 3000);
    }
    return clearAddressBarAutoHide;
  }, [
    clearAddressBarAutoHide,
    isDeveloperAddressBarVisible,
    isDeveloperAddressBarFocused,
  ]);

  const handleShouldStartLoadWithRequest = (request: { url: string }) => {
    const decision = navigationDecision(request.url);
    if (decision === "allow") return true;
    if (decision === "open-externally") {
      WebBrowser.openBrowserAsync(request.url);
    }
    return false;
  };

  const handleNavigationStateChange = (navigationState: WebViewNavigation) => {
    if (!navigationState.url) return;
    handleNavigationUrlChange(navigationState.url);
    setCurrentUrl(navigationState.url);
    setAddressInput(navigationState.url);
    if (!isDeveloperAddressBarFocused) {
      setIsDeveloperAddressBarVisible(false);
    }
  };

  const goHome = () => {
    setCurrentUrl(NOSTROOTS_WEB_URL);
    setAddressInput(NOSTROOTS_WEB_URL);
  };

  const handleDeveloperGo = () => {
    const url = normalizeDeveloperUrl(addressInput);
    setCurrentUrl(url);
    setAddressInput(url);
    setIsDeveloperAddressBarFocused(false);
    setIsDeveloperAddressBarVisible(false);
  };

  return (
    <View className="flex-1 bg-primary">
      <View
        testID="browser-header"
        className="bg-primary flex-row items-start gap-3 px-6 pr-10"
        style={{
          height: insets.top + 72,
          paddingTop: insets.top + 14,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close NIP-07 Browser"
          onPress={() => router.replace(ROUTES.HOME)}
          className="h-[42px] w-[42px] items-center justify-center rounded-full bg-white/95"
        >
          <Ionicons name="close-outline" size={24} color="#0f172a" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Nostroots"
          onPress={goHome}
          className="min-h-11 flex-1 flex-row items-center gap-2"
        >
          <Ionicons name="home-outline" size={19} color="#ffffff" />
          <Text className="text-white text-lg font-extrabold">Nostroots</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Browser settings"
          onPress={() => router.push(ROUTES.SETTINGS)}
          className="h-[42px] w-[42px] items-center justify-center rounded-full bg-white/95"
        >
          <Ionicons name="settings-outline" size={22} color="#0f172a" />
        </Pressable>
      </View>

      <WebView
        ref={webViewRef}
        testID="nostroots-webview"
        source={{ uri: currentUrl }}
        applicationNameForUserAgent={NOSTROOTS_BROWSER_USER_AGENT}
        injectedJavaScriptBeforeContentLoaded={`${createNip7InjectionScript()}\n${createNotificationBridgeInjectionScript()}`}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        originWhitelist={["*"]}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: "#ffffff" }}
      />

      {isDeveloperAddressBarVisible ? (
        <View
          testID="developer-address-bar"
          className="absolute left-3 right-3 min-h-14 flex-row items-center gap-2 rounded-xl border border-border bg-background/95 p-2"
          style={{ bottom: insets.bottom + 10 }}
        >
          <TextInput
            accessibilityLabel="Developer URL"
            value={addressInput}
            onChangeText={setAddressInput}
            onSubmitEditing={handleDeveloperGo}
            onFocus={() => setIsDeveloperAddressBarFocused(true)}
            onBlur={() => setIsDeveloperAddressBarFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectTextOnFocus
            className="min-h-10 flex-1 rounded-md bg-muted px-3 text-foreground"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to URL"
            onPress={handleDeveloperGo}
            className="min-h-10 min-w-12 items-center justify-center rounded-md bg-primary"
          >
            <Text className="font-bold text-primary-foreground">Go</Text>
          </Pressable>
        </View>
      ) : null}

      {!isDeveloperAddressBarVisible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show developer address bar"
          onPress={() => setIsDeveloperAddressBarVisible(true)}
          className="absolute right-4 h-[46px] w-[46px] items-center justify-center rounded-full border border-border bg-background/95"
          style={{ bottom: insets.bottom + 12 }}
        >
          <Ionicons name="link-outline" size={21} color="#0f172a" />
        </Pressable>
      ) : null}

      <Nip7PermissionModal
        prompt={permissionPrompt}
        onAllow={allowPrompt}
        onDeny={denyPrompt}
      />
    </View>
  );
}

function Nip7PermissionModal({
  prompt,
  onAllow,
  onDeny,
}: {
  prompt: PermissionPrompt | null;
  onAllow: (remember: boolean) => void;
  onDeny: () => void;
}) {
  const [remember, setRemember] = useState(false);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={!!prompt}
      onRequestClose={onDeny}
    >
      <View className="flex-1 justify-end bg-slate-900/30">
        <View className="gap-4 rounded-t-2xl bg-background p-6 pb-8">
          <View className="gap-2">
            <Text className="text-foreground text-xl font-extrabold">
              Allow NIP-07 key access?
            </Text>
            <Text className="text-muted-foreground text-base leading-6">
              {prompt?.host || "This website"} wants to use your Nostr key in
              Nostroots Browser. Allow this only for websites you trust.
            </Text>
          </View>

          <View className="flex-row items-center gap-3">
            <Switch
              accessibilityLabel="Remember this website"
              value={remember}
              onValueChange={setRemember}
              trackColor={{ false: "#cbd5e1", true: "#99f6e4" }}
              thumbColor={remember ? "#0f766e" : "#ffffff"}
            />
            <Text className="text-foreground flex-1 font-bold">
              Remember this website
            </Text>
          </View>

          <View className="flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Don't allow NIP-07 access"
              onPress={() => {
                setRemember(false);
                onDeny();
              }}
              className="min-h-12 flex-1 items-center justify-center rounded-md border border-border bg-background"
            >
              <Text className="text-foreground font-bold">Don't allow</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Allow NIP-07 access"
              onPress={() => {
                const shouldRemember = remember;
                setRemember(false);
                onAllow(shouldRemember);
              }}
              className="min-h-12 flex-1 items-center justify-center rounded-md bg-primary"
            >
              <Text className="font-extrabold text-primary-foreground">
                Allow
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
