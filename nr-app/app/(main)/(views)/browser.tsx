import { resolveNip7BrowserInitialUrl } from "@/browser/browser-route.utils";
import { BrowserScreen } from "@/browser/BrowserScreen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ROUTES } from "@/constants/routes";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useAppSelector } from "@/redux/hooks";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
import { settingsSelectors } from "@/redux/slices/settings.slice";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function Nip7BrowserRoute() {
  const router = useRouter();
  const colors = useThemeColors();
  const { url } = useLocalSearchParams<{ url?: string }>();
  const initialUrl = resolveNip7BrowserInitialUrl(url);
  const areTestFeaturesEnabled = useAppSelector(
    settingsSelectors.selectAreTestFeaturesEnabled,
  );
  const isKeystoreLoaded = useAppSelector(
    keystoreSelectors.selectIsKeystoreLoaded,
  );
  const hasKey = useAppSelector(
    keystoreSelectors.selectHasPrivateKeyInSecureStorage,
  );

  if (!areTestFeaturesEnabled) {
    return <Redirect href={ROUTES.HOME} />;
  }

  if (!isKeystoreLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.primary} />
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
          onPress={() => router.push(ROUTES.SETTINGS)}
        />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BrowserScreen initialUrl={initialUrl} />
    </>
  );
}
