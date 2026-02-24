import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { IdCardLanyardIcon } from "lucide-react-native";
import { selectFeatureFlags } from "@/redux/slices/settings.slice";
import { useAppSelector } from "@/redux/hooks";

export default function OnboardingIdentityScreen() {
  const router = useRouter();
  const { useSkipOnboarding } = useAppSelector(selectFeatureFlags);

  const goBack = () => {
    router.back();
  };

  const goNext = () => {
    router.push("/onboarding/key");
  };

  const goSkip = () => {
    router.push("/(tabs)");
  };

  return (
    <>
      <View className="flex items-center gap-6">
        <IdCardLanyardIcon size={128} color="#fff" strokeWidth={0.5} />

        <Text variant="h1" className="my-0">
          Your Key Is Your Identity{" "}
        </Text>
      </View>

      <View>
        <Text variant="p" className="mt-0">
          This app is built on the Nostr protocol — an open,
          censorship-resistant social layer where you, not a company, own your
          identity.
        </Text>

        <Text variant="p">
          With keys, your identity can move across apps and survive platforms.
          Lose the key, lose the identity. Share the key, share your power.
        </Text>
      </View>

      <View className="flex flex-row gap-2">
        {router.canGoBack() && (
          <Button variant="secondary" onPress={goBack} size="lg" title="Back" />
        )}
        <Button
          variant="secondary"
          onPress={goNext}
          size="lg"
          title="Continue"
        />
        {useSkipOnboarding && (
          <Button
            variant="outline"
            onPress={goSkip}
            size="lg"
            title="Skip"
            textClassName="text-white"
          />
        )}
      </View>

      <View className="p-4 opacity-75">
        <Text variant="muted" className="text-xs uppercase text-center">
          This app is a work in progress.
        </Text>
      </View>
    </>
  );
}
