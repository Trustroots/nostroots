import { useRouter } from "expo-router";
import React from "react";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/ui/button";

/**
 * New Onboarding entry screen (experimental).
 *
 * This is the conceptual entrypoint for the new multi-step onboarding flow.
 *
 * Behavior:
 * - Minimal, placeholder-only.
 * - Uses the existing design system components.
 * - Safe to use when the `useNewOnboarding` feature flag is enabled.
 *
 * Routing usage (conceptual ONLY; not wired automatically here):
 * - At startup, if `settingsSelectors.selectUseNewOnboarding(state)` is true:
 *     router.replace("/(onboarding)/new-onboarding")
 *   to enter this new flow.
 * - Otherwise:
 *     continue using the existing WelcomeModal / OnboardModal onboarding.
 *
 * Flow:
 * - This screen acts as an overview/intro.
 * - Primary action routes into the first dedicated step:
 *     "/(onboarding)/welcome"
 */
export default function NewOnboardingScreen() {
  const router = useRouter();

  const handlePrimaryAction = () => {
    // Move into the first step of the new multi-screen onboarding flow.
    // Placeholder-only: no state changes, just navigation.
    router.replace("/(tabs)");
  };

  return (
    <>
      <ThemedView className="flex-1 items-center justify-center px-8 gap-6 bg-white">
        <ThemedText className="text-3xl font-bold text-gray-900 text-center">
          New Onboarding (Preview)
        </ThemedText>

        <ThemedText className="text-gray-600 text-center leading-relaxed">
          This experimental flow introduces a simple, route-based onboarding
          experience for Nostroots.
        </ThemedText>

        <ThemedText className="text-gray-600 text-center leading-relaxed">
          When fully wired, it will guide new users through welcome messaging,
          permissions, map introduction, and a short wrap-up, without changing
          the existing default onboarding behavior.
        </ThemedText>

        <Button title="Start" onPress={handlePrimaryAction} size="lg" />
      </ThemedView>
    </>
  );
}
