import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

import { useAppSelector } from "@/redux/hooks";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
import { settingsSelectors } from "@/redux/slices/settings.slice";
import { formatDebugInfo } from "@/utils/debugInfo.utils";

/** The debug block shown in the disclosure and appended to support messages. */
export function useDebugInfo(): string {
  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub);
  const trustrootsUsername = useAppSelector(settingsSelectors.selectUsername);

  return formatDebugInfo({
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
}
