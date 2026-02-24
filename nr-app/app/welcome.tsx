import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function WelcomeScreen() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.replace("/onboarding");
  };

  return (
    <View className="absolute inset-0 p-safe-offset-6 bg-background flex justify-center items-center gap-6">
      <Text
        variant="h1"
        className="text-3xl font-bold text-foreground text-center mb-0"
      >
        Welcome to Nostroots
      </Text>

      <View className="w-1/2 h-1 bg-primary" />

      <View className="flex gap-4 max-w-sm">
        <Text className="text-muted-foreground leading-relaxed text-balance text-center">
          Connect with travelers and locals through shared map notes and
          experiences.
        </Text>

        <Text className="text-muted-foreground leading-relaxed text-balance text-center">
          Share locations, tips, and stories without relying on centralized
          platforms.
        </Text>
      </View>

      <View className="w-full max-w-xs">
        <Button
          onPress={handleGetStarted}
          title="Get Started"
          size="lg"
          textClassName="uppercase"
        />
      </View>

      <Text variant="muted" className="text-center uppercase text-xs">
        This app is a work in progress.
      </Text>
    </View>
  );
}
