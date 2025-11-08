import { Redirect } from "expo-router";

export default function OnboardingIndex() {
  // Default entry: go to Identity step
  return <Redirect href="/onboarding/identity" />;
}
