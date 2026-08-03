import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import * as Updates from "expo-updates";
import * as WebBrowser from "expo-web-browser";
import { LifeBuoy } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Platform } from "react-native";

import { signEventTemplate } from "@/nostr/keystore.nostr";
import { useAppSelector } from "@/redux/hooks";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
import { settingsSelectors } from "@/redux/slices/settings.slice";
import { sendSupportMessage } from "@/services/nrBridge.service";
import {
  formatDebugInfo,
  TRUSTROOTS_SUPPORT_URL,
} from "@/utils/debugInfo.utils";
import { Button } from "./ui/button";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

export function SendDebugInfoButton() {
  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub);
  const trustrootsUsername = useAppSelector(settingsSelectors.selectUsername);
  const [isSending, setIsSending] = useState(false);

  const handlePress = useCallback(async () => {
    const debugInfo = formatDebugInfo({
      appVersion: Constants.expoConfig?.version,
      buildNumber:
        Platform.OS === "ios"
          ? Constants.expoConfig?.ios?.buildNumber
          : Constants.expoConfig?.android?.versionCode,
      commitId: Constants.expoConfig?.extra?.commitId,
      platform: Platform.OS,
      platformVersion: Platform.Version,
      updateChannel: Updates.channel ?? undefined,
      updateId: Updates.updateId ?? undefined,
      updateCreatedAt: Updates.createdAt,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      npub: npub ?? undefined,
      trustrootsUsername: trustrootsUsername ?? undefined,
      generatedAt: new Date(),
    });

    setIsSending(true);
    try {
      await sendSupportMessage({
        message: debugInfo,
        sign: signEventTemplate,
      });
      Alert.alert(
        "Debug info sent",
        "Thanks! We sent your app's debug info to Trustroots support. If you are waiting on a reply, check the email address on your Trustroots account.",
      );
    } catch {
      await copyAndOfferSupportForm(debugInfo);
    } finally {
      setIsSending(false);
    }
  }, [npub, trustrootsUsername]);

  return (
    <Button
      onPress={handlePress}
      disabled={isSending}
      variant="outline"
      className="w-full"
    >
      {isSending ? (
        <ActivityIndicator size="small" />
      ) : (
        <Icon as={LifeBuoy} size={16} className="text-foreground" />
      )}
      <Text>{isSending ? "Sending…" : "Send debug info to support"}</Text>
    </Button>
  );
}

/**
 * Fallback for when the send fails -- no key yet, no connectivity, or the
 * bridge is down. The user is stuck either way, so we keep the manual route
 * open rather than leaving them with an error.
 */
async function copyAndOfferSupportForm(debugInfo: string): Promise<void> {
  await Clipboard.setStringAsync(debugInfo);

  Alert.alert(
    "Could not send",
    "We could not reach support, so we copied your app's debug info to the clipboard instead. Paste it into the support form so we can see what went wrong.",
    [
      { text: "Not now", style: "cancel" },
      {
        text: "Open support",
        onPress: () => {
          WebBrowser.openBrowserAsync(TRUSTROOTS_SUPPORT_URL);
        },
      },
    ],
  );
}
