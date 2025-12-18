import { Slot, usePathname } from "expo-router";
import { ScrollView, View } from "react-native";

import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/utils/cn.utils";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

const steps = [
  { id: "identity", label: "Identity" },
  { id: "key", label: "Key" },
  { id: "link", label: "Link" },
  { id: "backup-confirm", label: "Backup" },
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
  const { steps, currentStepIndex } = useOnboardingProgress();

  return (
    <View className="flex flex-row gap-1 items-center p-4">
      {steps.map((step, index) => {
        const isActive = index === currentStepIndex;
        return (
          <View
            key={step.id}
            className={cn("bg-white rounded-full size-1", {
              "w-6": isActive,
              "opacity-50": !isActive,
            })}
          />
        );
      })}
    </View>
  );
}

export default function OnboardingLayout() {
  return (
    <View className="flex-1 bg-primary p-safe flex flex-col justify-center">
      <TextClassContext.Provider value="text-white text-center">
        <OnboardingHeader />
        <KeyboardAwareScrollView
          bottomOffset={100}
          contentContainerClassName="flex grow flex-col items-center justify-center gap-8 px-6 py-12"
        >
          <Slot />
        </KeyboardAwareScrollView>
      </TextClassContext.Provider>
    </View>
  );
}
