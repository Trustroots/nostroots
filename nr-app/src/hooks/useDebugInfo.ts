import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useState } from "react";
import { Platform } from "react-native";

import { useAppSelector } from "@/redux/hooks";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
import { settingsSelectors } from "@/redux/slices/settings.slice";
import { formatDebugInfo } from "@/utils/debugInfo.utils";

export function useDebugInfo(): string {
  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub);
  const trustrootsUsername = useAppSelector(settingsSelectors.selectUsername);

  const [generatedAt] = useState(() => new Date());

  return formatDebugInfo({
    appVersion:
      Application.nativeApplicationVersion ?? Constants.expoConfig?.version,
    buildNumber: Application.nativeBuildVersion ?? undefined,
    commitId: Constants.expoConfig?.extra?.commitId,
    platform: Platform.OS,
    platformVersion: Platform.Version,
    updateChannel: Updates.channel || undefined,
    updateId: Updates.updateId ?? undefined,
    updateCreatedAt: Updates.createdAt,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    npub: npub ?? undefined,
    trustrootsUsername: trustrootsUsername ?? undefined,
    generatedAt,
  });
}
