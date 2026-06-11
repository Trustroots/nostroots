import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import Toast from "react-native-root-toast";

import {
  clearNip7Permissions,
  getPermissionEntries,
  revokeOrigin,
  type Nip7PermissionEntry,
} from "@/browser/permission-store";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { ROUTES } from "@/constants/routes";

export function BrowserSettingsSection() {
  const router = useRouter();
  const [entries, setEntries] = useState<Nip7PermissionEntry[]>([]);

  const refreshEntries = useCallback(async () => {
    setEntries(await getPermissionEntries());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshEntries();
    }, [refreshEntries]),
  );

  const handleRevoke = async (entry: Nip7PermissionEntry) => {
    await revokeOrigin(entry.origin, entry.method);
    await refreshEntries();
    Toast.show("Website permission revoked", {
      duration: Toast.durations.SHORT,
    });
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear all browser permissions?",
      "Remembered NIP-07 website permissions will be removed. Trusted sites can still auto-allow on next use.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: async () => {
            await clearNip7Permissions();
            await refreshEntries();
            Toast.show("Browser permissions cleared", {
              duration: Toast.durations.SHORT,
            });
          },
        },
      ],
    );
  };

  return (
    <Section>
      <Text variant="h2">Browser</Text>
      <Text variant="p">
        Dev NIP-07 browser for testing vibe/web with your app key.
      </Text>

      <Button
        title="Open NIP-07 Browser"
        onPress={() => router.push(ROUTES.NIP7_BROWSER)}
      />

      <Text variant="h3">Allowed websites</Text>
      {entries.length === 0 ? (
        <Text variant="p">No websites have used NIP-07 yet.</Text>
      ) : (
        <View className="gap-3">
          {entries.map((entry) => (
            <View
              key={entry.id}
              className="flex-row items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
            >
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Open ${entry.displayName} in NIP-07 browser`}
                className="min-w-0 flex-1 gap-1"
                onPress={() =>
                  router.push({
                    pathname: ROUTES.NIP7_BROWSER,
                    params: { url: entry.origin },
                  })
                }
              >
                <Text className="font-bold text-foreground">
                  {entry.displayName}
                </Text>
                <Text variant="small">{entry.detail}</Text>
                <Text variant="small" className="text-primary">
                  {entry.origin}
                </Text>
              </Pressable>
              {entry.canRevoke ? (
                <Button
                  title="Revoke"
                  variant="outline"
                  size="sm"
                  onPress={() => void handleRevoke(entry)}
                />
              ) : null}
            </View>
          ))}
        </View>
      )}

      {entries.some((entry) => entry.canRevoke) ? (
        <Button
          title="Clear all permissions"
          variant="outline"
          onPress={handleClearAll}
        />
      ) : null}
    </Section>
  );
}
