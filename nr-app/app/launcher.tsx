import { useRouter } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { ROUTES } from "@/constants/routes";

export default function LauncherScreen() {
  const router = useRouter();

  return (
    <View className="absolute inset-0 p-safe-offset-6 bg-background flex justify-center items-center gap-6">
      <Text
        variant="h1"
        className="text-3xl font-bold text-foreground text-center mb-0"
      >
        Trustroots
      </Text>

      <View className="w-1/2 h-1 bg-primary" />

      <View className="w-full max-w-sm gap-4">
        <Pressable
          testID="launcher-nostroots"
          accessibilityRole="button"
          accessibilityLabel="Nostroots"
          onPress={() => router.replace(ROUTES.HOME)}
          className="rounded-xl bg-card p-5 active:opacity-80"
        >
          <Text className="text-xl font-bold text-foreground">Nostroots</Text>
          <Text className="text-muted-foreground">Trustroots on nostr</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More coming soon"
          accessibilityState={{ disabled: true }}
          disabled
          className="rounded-xl border border-border p-5 opacity-50"
        >
          <Text className="text-xl font-bold text-foreground">
            More coming soon
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
