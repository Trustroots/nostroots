import { useEffect } from "react";
import { AppState } from "react-native";
import * as Updates from "expo-updates";
import Toast from "react-native-root-toast";

export function useUpdateOnForeground() {
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
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
          console.log("Update check failed:", e);
        }
      }
    });

    return () => sub.remove();
  }, []);
}
