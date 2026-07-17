import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import * as Updates from "expo-updates";
import * as WebBrowser from "expo-web-browser";
import { LifeBuoy } from "lucide-react-native";
import { useCallback } from "react";
import { Alert, Platform } from "react-native";

import { useAppSelector } from "@/redux/hooks";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
import { settingsSelectors } from "@/redux/slices/settings.slice";
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

    await Clipboard.setStringAsync(debugInfo);

    Alert.alert(
      "Debug info copied",
      "We copied your app's debug info to the clipboard. Paste it into the support form so we can see what went wrong.\n\nIt includes your app version and your npub and Trustroots username if you have set them.",
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
  }, [npub, trustrootsUsername]);

  return (
    <Button onPress={handlePress} variant="outline" className="w-full">
      <Icon as={LifeBuoy} size={16} className="text-foreground" />
      <Text>Send debug info to support</Text>
    </Button>
  );
}
