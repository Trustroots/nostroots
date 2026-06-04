import LoadingScreen from "@/components/LoadingModal";
import { isE2EEnabled } from "@/utils/e2e.utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

function persistRootForScenario(scenarioName: string) {
  if (scenarioName === "pending-verify") {
    return {
      settings: JSON.stringify({
        areTestFeaturesEnabled: false,
        colorScheme: "system",
        forceOnboarding: false,
        forceWelcome: false,
        hasAcknowledgedExperimentalLayers: false,
        hasBeenOpenedBefore: true,
        isDataLoaded: true,
        keyWasImported: false,
        pendingTrustrootsProfileUsername: null,
        pendingTrustrootsUsername: "alice",
        useSkipOnboarding: true,
        username: null,
      }),
      _persist: JSON.stringify({ rehydrated: true, version: -1 }),
    };
  }

  return null;
}

export default function E2ESeedRoute() {
  const router = useRouter();
  const { scenario = "default" } = useLocalSearchParams<{
    scenario?: string;
  }>();

  useEffect(() => {
    async function seed() {
      if (!isE2EEnabled()) {
        router.replace("/");
        return;
      }

      const scenarioName = Array.isArray(scenario) ? scenario[0] : scenario;
      const persistedRoot = persistRootForScenario(scenarioName);

      await AsyncStorage.setItem("nostroots:e2e:scenario", scenarioName);
      if (persistedRoot) {
        await AsyncStorage.setItem(
          "persist:root",
          JSON.stringify(persistedRoot),
        );
      }
      router.replace("/");
    }

    seed();
  }, [router, scenario]);

  return <LoadingScreen loading={true} />;
}
