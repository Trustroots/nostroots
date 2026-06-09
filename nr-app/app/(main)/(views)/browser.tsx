import { BrowserScreen } from "@/browser/BrowserScreen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ROUTES } from "@/constants/routes";
import { getHasPrivateKeyInSecureStorage } from "@/nostr/keystore.nostr";
import { useAppSelector } from "@/redux/hooks";
import { settingsSelectors } from "@/redux/slices/settings.slice";
import { Redirect, Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Nip7BrowserRoute() {
  const router = useRouter();
  const areTestFeaturesEnabled = useAppSelector(
    settingsSelectors.selectAreTestFeaturesEnabled,
  );
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    getHasPrivateKeyInSecureStorage().then((nextHasKey) => {
      if (isMounted) {
        setHasKey(nextHasKey);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!areTestFeaturesEnabled) {
    return <Redirect href={ROUTES.HOME} />;
  }

  if (hasKey === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#12a585" />
      </View>
    );
  }

  if (!hasKey) {
    return (
      <View className="flex-1 justify-center gap-4 bg-background px-safe-offset-6">
        <Stack.Screen
          options={{
            title: "NIP-07 Browser",
          }}
        />
        <Text variant="h2">No Nostr key available</Text>
        <Text variant="p">
          Import or create a key in Settings before using the dev NIP-07
          browser.
        </Text>
        <Button
          title="Open Settings"
          onPress={() => router.replace(ROUTES.SETTINGS)}
        />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BrowserScreen developerMode={areTestFeaturesEnabled} />
    </>
  );
}
