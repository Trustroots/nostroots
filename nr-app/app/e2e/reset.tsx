import LoadingScreen from "@/components/LoadingModal";
import {
  SECURE_STORE_PRIVATE_KEY_HEX_KEY,
  SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
} from "@/constants";
import { isE2EEnabled } from "@/utils/e2e.utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useEffect } from "react";

export default function E2EResetRoute() {
  const router = useRouter();

  useEffect(() => {
    async function reset() {
      if (!isE2EEnabled()) {
        router.replace("/");
        return;
      }

      await AsyncStorage.clear();
      await SecureStore.deleteItemAsync(SECURE_STORE_PRIVATE_KEY_HEX_KEY);
      await SecureStore.deleteItemAsync(SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC);
      router.replace("/");
    }

    reset();
  }, [router]);

  return <LoadingScreen loading={true} />;
}
