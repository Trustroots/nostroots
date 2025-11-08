import { Stack, useRouter } from "expo-router";
import React from "react";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/ui/button";

/**
 * New Onboarding screen (experimental).
 *
 * This is a minimal stub implementation that:
 * - Uses the existing design system components.
 * - Is safe to link to from navigation when the `useNewOnboarding` feature flag is enabled.
 * - Does not alter existing onboarding behavior by itself.
 *
 * Routing usage (conceptual):
 * - When wiring the router, if `selectUseNewOnboarding(state)` is true,
 *   navigate to this route instead of showing the legacy onboarding modals.
 */
export default function NewOnboardingScreen() {
  const router = useRouter();

  const handlePrimaryAction = () => {
    // Placeholder: when integrating, this can:
    // - Complete onboarding state,
    // - Route into the main app stack (e.g. "(tabs)"),
    // - Or perform any necessary setup.
    // For now, keep behavior minimal and non-breaking.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <>
      {/* Local Stack to provide a header if this route is pushed directly */}
      <Stack.Screen
        options={{
          title: "New Onboarding",
          headerShown: true,
        }}
      />

      <ThemedView className="flex-1 items-center justify-center px-8 gap-6 bg-white">
        <ThemedText className="text-3xl font-bold text-gray-900 text-center">
          New Onboarding
        </ThemedText>

        <ThemedText className="text-gray-600 text-center leading-relaxed">
          This is the experimental onboarding flow. Enable it via the settings
          feature flag to try a simpler, route-based onboarding experience.
        </ThemedText>

        <ThemedText className="text-gray-600 text-center leading-relaxed">
          When fully wired, this screen will guide new users through account
          setup, key management, and verification using the Nostroots and
          Trustroots ecosystem.
        </ThemedText>

        <Button title="Continue" onPress={handlePrimaryAction} size="lg" />
      </ThemedView>
    </>
  );
}
