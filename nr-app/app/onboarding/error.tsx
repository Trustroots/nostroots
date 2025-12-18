import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { AlertTriangleIcon } from "lucide-react-native";

export default function OnboardingErrorScreen() {
  const router = useRouter();

  const handleContinue = () => {
    router.replace("/onboarding/link");
  };

  const handleClose = () => {
    router.replace("/(tabs)");
  };

  return (
    <>
      <View className="flex items-center gap-6">
        <AlertTriangleIcon size={96} color="#fff" strokeWidth={0.5} />
        <Text variant="h1" className="my-0">
          Setup Issue
        </Text>
      </View>

      <View>
        <Text variant="p" className="mt-0">
          Looks like there was an issue setting up your trustroots.org account.
        </Text>
        <Text variant="p">
          You can try verifying your account again. Some setup steps may need to
          be repeated.
        </Text>
      </View>

      <View className="flex flex-row gap-2">
        <Button
          variant="secondary"
          onPress={handleContinue}
          size="lg"
          title="Try Again"
        />
        <Button
          variant="outline"
          onPress={handleClose}
          size="lg"
          title="Close"
          textClassName="text-white"
        />
      </View>

      <View className="p-4 opacity-75">
        <Text variant="muted" className="text-xs uppercase text-center">
          This app is a work in progress.
        </Text>
      </View>
    </>
  );
}
