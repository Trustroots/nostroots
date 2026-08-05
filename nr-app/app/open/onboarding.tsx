import { Redirect, useLocalSearchParams } from "expo-router";

export default function OpenOnboardingRoute() {
  const { username } = useLocalSearchParams<{ username?: string }>();

  return (
    <Redirect
      href={{
        pathname: "/onboarding/trustroots",
        params: username ? { username } : undefined,
      }}
    />
  );
}
