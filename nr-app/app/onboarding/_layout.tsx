import { Slot, usePathname } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";

const steps = [
  { id: "new-onboarding", label: "Intro" },
  { id: "welcome", label: "Welcome" },
  { id: "permissions", label: "Permissions" },
  { id: "map-intro", label: "Map" },
  { id: "finalize", label: "Done" },
];

function useOnboardingProgress() {
  const pathname = usePathname() || "";

  // Extract the last non-empty segment from the pathname
  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];

  const currentStepIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === lastSegment),
  );

  const totalSteps = steps.length;
  const isKnownStep = steps.some((step) => step.id === lastSegment);

  const currentStepNumber =
    isKnownStep && currentStepIndex >= 0 && currentStepIndex < totalSteps
      ? currentStepIndex + 1
      : 1;

  return {
    steps,
    currentStepIndex:
      isKnownStep && currentStepIndex >= 0 ? currentStepIndex : 0,
    currentStepNumber,
    totalSteps,
    isKnownStep,
  };
}

function OnboardingHeader() {
  const {
    steps,
    currentStepIndex,
    currentStepNumber,
    totalSteps,
    isKnownStep,
  } = useOnboardingProgress();

  return (
    <View style={styles.headerContainer}>
      <ThemedText type="subtitle" style={styles.headerTitle}>
        {isKnownStep
          ? `Step ${currentStepNumber} of ${totalSteps}`
          : "Onboarding"}
      </ThemedText>

      <View style={styles.stepsRow}>
        {steps.map((step, index) => {
          const isActive = index === currentStepIndex && isKnownStep;
          return (
            <View
              key={step.id}
              style={[
                styles.stepIndicator,
                isActive && styles.stepIndicatorActive,
              ]}
            >
              <ThemedText
                style={[styles.stepLabel, isActive && styles.stepLabelActive]}
              >
                {step.label}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function OnboardingFooter() {
  return (
    <View style={styles.footerContainer}>
      <ThemedText style={styles.footerText}>
        This is an experimental onboarding flow.
      </ThemedText>
    </View>
  );
}

export default function OnboardingLayout() {
  return (
    <ThemedView style={styles.container}>
      <OnboardingHeader />
      <View style={styles.contentContainer}>
        <Slot />
      </View>
      <OnboardingFooter />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
    gap: 16,
  },
  headerContainer: {
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#D4D4D8",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  stepsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stepIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  stepIndicatorActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  stepLabel: {
    fontSize: 10,
    color: "#6B7280",
  },
  stepLabelActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  contentContainer: {
    flex: 1,
  },
  footerContainer: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  footerText: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
  },
});
