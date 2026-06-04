import * as WebBrowser from "expo-web-browser";
import { Home, Settings } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, {
  WebViewMessageEvent,
  WebViewNavigation,
} from "react-native-webview";

import {
  NOSTROOTS_BROWSER_USER_AGENT,
  NOSTROOTS_WEB_ORIGIN,
  NOSTROOTS_WEB_URL,
  SECURE_STORE_DEVELOPER_MODE_KEY,
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
  hostForOrigin,
  isRememberedOrigin,
  isTrustedNip7Origin,
  originForUrl,
  recordTrustedOriginUse,
  rememberOrigin,
} from "@/nostr/permission-store";
import {
  createNip7InjectionScript,
  createNip7ResponseScript,
  failure,
  handleNip7BridgeMessage,
  isKnownNip7Method,
  requestMetadata,
} from "@/nostr/nip7-bridge";
import { createNotificationBridgeInjectionScript } from "@/nostr/notification-bridge";
import {
  navigationDecision,
  normalizeDeveloperUrl,
} from "@/screens/navigation-policy";
import { SettingsScreen } from "@/screens/settings-screen";
import {
  readBooleanPreference,
  writeBooleanPreference,
} from "@/storage/preferences";

interface BrowserScreenProps {
  onKeyCleared: () => void;
}

interface PermissionPrompt {
  origin: string;
  host: string;
  method: string;
}

const permissionDeniedMessage =
  "This website is not allowed to use the Nostroots Browser NIP-07 key.";

export function BrowserScreen({ onKeyCleared }: BrowserScreenProps) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const currentUrlRef = useRef<string>(NOSTROOTS_WEB_URL);
  const pendingMessagesByOrigin = useRef<Record<string, string[]>>({});
  const [isShowingSettings, setIsShowingSettings] = useState(false);
  const [permissionPrompt, setPermissionPrompt] =
    useState<PermissionPrompt | null>(null);
  const [isDeveloperModeEnabled, setIsDeveloperModeEnabledState] =
    useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>(NOSTROOTS_WEB_URL);
  const [addressInput, setAddressInput] = useState<string>(NOSTROOTS_WEB_URL);

  useEffect(() => {
    readBooleanPreference(SECURE_STORE_DEVELOPER_MODE_KEY).then(
      setIsDeveloperModeEnabledState,
    );
  }, []);

  const setDeveloperMode = async (value: boolean) => {
    setIsDeveloperModeEnabledState(value);
    await writeBooleanPreference(SECURE_STORE_DEVELOPER_MODE_KEY, value);
  };

  const sendBridgeResponse = async (rawMessage: string) => {
    const response = await handleNip7BridgeMessage(rawMessage, {
      getPublicKey: getPublicKeyHexFromSecureStorage,
      signEvent: signEventTemplate,
      nip44Encrypt,
      nip44Decrypt,
      nip04Encrypt,
      nip04Decrypt,
    });
    webViewRef.current?.injectJavaScript(createNip7ResponseScript(response));
  };

  const denyBridgeMessage = (rawMessage: string) => {
    const id = requestMetadata(rawMessage)?.id || "unknown";
    webViewRef.current?.injectJavaScript(
      createNip7ResponseScript(failure(id, permissionDeniedMessage)),
    );
  };

  const handleMessage = async (event: WebViewMessageEvent) => {
    const rawMessage = event.nativeEvent.data;
    const metadata = requestMetadata(rawMessage);
    if (!metadata || !isKnownNip7Method(metadata.method)) {
      await sendBridgeResponse(rawMessage);
      return;
    }

    const origin = originForUrl(currentUrlRef.current);
    if (!origin) {
      denyBridgeMessage(rawMessage);
      return;
    }

    if (isTrustedNip7Origin(origin)) {
      await recordTrustedOriginUse(origin);
      await sendBridgeResponse(rawMessage);
      return;
    }

    if (await isRememberedOrigin(origin)) {
      await sendBridgeResponse(rawMessage);
      return;
    }

    pendingMessagesByOrigin.current[origin] = [
      ...(pendingMessagesByOrigin.current[origin] || []),
      rawMessage,
    ];
    if (!permissionPrompt) {
      setPermissionPrompt({
        origin,
        host: hostForOrigin(origin),
        method: metadata.method,
      });
    }
  };

  const allowPrompt = async (remember: boolean) => {
    if (!permissionPrompt) return;
    const { origin } = permissionPrompt;
    if (remember) {
      await rememberOrigin(origin);
    }
    const messages = pendingMessagesByOrigin.current[origin] || [];
    delete pendingMessagesByOrigin.current[origin];
    setPermissionPrompt(null);
    for (const message of messages) {
      await sendBridgeResponse(message);
    }
  };

  const denyPrompt = () => {
    if (!permissionPrompt) return;
    const { origin } = permissionPrompt;
    const messages = pendingMessagesByOrigin.current[origin] || [];
    delete pendingMessagesByOrigin.current[origin];
    setPermissionPrompt(null);
    for (const message of messages) {
      denyBridgeMessage(message);
    }
  };

  const handleShouldStartLoadWithRequest = (request: { url: string }) => {
    const decision = navigationDecision(request.url, isDeveloperModeEnabled);
    if (decision === "allow") return true;
    if (decision === "open-externally") {
      WebBrowser.openBrowserAsync(request.url);
    }
    return false;
  };

  const handleNavigationStateChange = (navigationState: WebViewNavigation) => {
    if (!navigationState.url) return;
    currentUrlRef.current = navigationState.url;
    setCurrentUrl(navigationState.url);
    setAddressInput(navigationState.url);
  };

  const goHome = () => {
    currentUrlRef.current = NOSTROOTS_WEB_URL;
    setCurrentUrl(NOSTROOTS_WEB_URL);
    setAddressInput(NOSTROOTS_WEB_URL);
  };

  const handleDeveloperGo = () => {
    const url = normalizeDeveloperUrl(addressInput);
    currentUrlRef.current = url;
    setCurrentUrl(url);
    setAddressInput(url);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#12a585" }}>
      <View
        testID="browser-header"
        style={{
          height: 86,
          paddingTop: 14,
          paddingLeft: 24,
          paddingRight: 40,
          backgroundColor: "#12a585",
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Nostroots"
          onPress={goHome}
          style={{
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flex: 1,
          }}
        >
          <Home size={18} color="#ffffff" />
          <Text
            style={{
              color: "#ffffff",
              fontSize: 17,
              fontWeight: "800",
            }}
          >
            Nostroots
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => setIsShowingSettings(true)}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255, 255, 255, 0.94)",
          }}
        >
          <Settings size={22} color="#0f172a" />
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
        originWhitelist={isDeveloperModeEnabled ? ["*"] : [NOSTROOTS_WEB_ORIGIN]}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: "#ffffff" }}
      />

      {isDeveloperModeEnabled ? (
        <View
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: insets.bottom + 10,
            minHeight: 56,
            padding: 8,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "rgba(15, 23, 42, 0.12)",
            backgroundColor: "rgba(255, 255, 255, 0.96)",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
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
              minHeight: 40,
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
              minWidth: 48,
              minHeight: 40,
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

      <Modal
        animationType="slide"
        visible={isShowingSettings}
        presentationStyle="pageSheet"
        onRequestClose={() => setIsShowingSettings(false)}
      >
        <SettingsScreen
          developerMode={isDeveloperModeEnabled}
          onDeveloperModeChange={setDeveloperMode}
          onClose={() => setIsShowingSettings(false)}
          onKeyCleared={onKeyCleared}
        />
      </Modal>

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
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(15, 23, 42, 0.28)",
        }}
      >
        <View
          style={{
            gap: 18,
            padding: 22,
            paddingBottom: 30,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            backgroundColor: "#f8fafc",
          }}
        >
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 21, fontWeight: "800", color: "#0f172a" }}>
              Allow NIP-07 key access?
            </Text>
            <Text style={{ color: "#475569", fontSize: 16, lineHeight: 23 }}>
              {prompt?.host || "This website"} wants to use your Nostr key in
              Nostroots Browser. Allow this only for websites you trust.
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Switch
              accessibilityLabel="Remember this website"
              value={remember}
              onValueChange={setRemember}
              trackColor={{ false: "#cbd5e1", true: "#99f6e4" }}
              thumbColor={remember ? "#0f766e" : "#ffffff"}
            />
            <Text style={{ flex: 1, color: "#0f172a", fontWeight: "700" }}>
              Remember this website
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Don't allow NIP-07 access"
              onPress={() => {
                setRemember(false);
                onDeny();
              }}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "#cbd5e1",
                backgroundColor: "#ffffff",
              }}
            >
              <Text style={{ color: "#0f172a", fontWeight: "700" }}>
                Don't allow
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Allow NIP-07 access"
              onPress={() => {
                const shouldRemember = remember;
                setRemember(false);
                onAllow(shouldRemember);
              }}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#12a585",
              }}
            >
              <Text style={{ color: "#ffffff", fontWeight: "800" }}>Allow</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export { navigationDecision, normalizeDeveloperUrl };
