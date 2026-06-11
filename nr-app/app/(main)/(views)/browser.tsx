import { BrowserScreen } from "@/browser/BrowserScreen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ROUTES } from "@/constants/routes";
import { useAppSelector } from "@/redux/hooks";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
import { settingsSelectors } from "@/redux/slices/settings.slice";
import { Redirect, Stack, useRouter } from "expo-router";
import { View } from "react-native";

export default function Nip7BrowserRoute() {
  const router = useRouter();
  const areTestFeaturesEnabled = useAppSelector(
    settingsSelectors.selectAreTestFeaturesEnabled,
  );
  const hasKey = useAppSelector(
    keystoreSelectors.selectHasPrivateKeyInSecureStorage,
  );

  if (!areTestFeaturesEnabled) {
    return <Redirect href={ROUTES.HOME} />;
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
          onPress={() => router.push(ROUTES.SETTINGS)}
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
