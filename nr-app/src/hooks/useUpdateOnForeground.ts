import { useEffect, useRef } from "react";
import { Alert, AppState, Linking, Platform } from "react-native";
import * as Updates from "expo-updates";
import Toast from "react-native-root-toast";

const IOS_STORE_URL =
  "https://apps.apple.com/app/nostroots/id6504516415";
const ANDROID_STORE_URL =
  "https://play.google.com/store/apps/details?id=org.trustroots.nostroots";

function getStoreUrl(): string {
  return Platform.OS === "ios" ? IOS_STORE_URL : ANDROID_STORE_URL;
}

/**
 * Returns true if the error from expo-updates indicates that the
 * available update requires a newer native binary (i.e. it cannot
 * be applied as an OTA update and the user must update from the
 * app store).
 */
function isNativeBinaryUpdateError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("newer native") ||
    msg.includes("incompatible") ||
    msg.includes("mismatch") ||
    msg.includes("does not match") ||
    msg.includes("no compatible update")
  );
}

function showManualUpdateAlert() {
  Alert.alert(
    "Update Required",
    "A new version of Nostroots is available that requires a manual update. Please update from the app store.",
    [
      { text: "Later", style: "cancel" },
      {
        text: "Open Store",
        onPress: () => {
          Linking.openURL(getStoreUrl());
        },
      },
    ],
  );
}

export function useUpdateOnForeground() {
  // Prevent showing the alert more than once per app session
  const hasShownManualUpdateAlert = useRef(false);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          Toast.show("Downloading app update…");
          await Updates.fetchUpdateAsync();
          Toast.show("Update downloaded, app will restart in 5 seconds.");
          setTimeout(async () => {
            await Updates.reloadAsync();
          }, 5000);
        }
      } catch (e) {
        console.warn("Update check failed:", e);
        if (isNativeBinaryUpdateError(e) && !hasShownManualUpdateAlert.current) {
          hasShownManualUpdateAlert.current = true;
          showManualUpdateAlert();
        }
      }
    };

    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        await checkForUpdates();
      }
    });

    // Also check on initial mount
    if (!__DEV__) {
      checkForUpdates();
    }

    return () => sub.remove();
  }, []);
}
