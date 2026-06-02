import LoadingScreen from "@/components/LoadingModal";
import { authenticateWithToken } from "@/services/nrBridge.service";
import { ensureOnboardingIdentity } from "@/services/onboardingIdentity.service";
import { finalizeTrustrootsProfilePublish } from "@/services/trustrootsProfile.service";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { settingsSelectors } from "@/redux/slices/settings.slice";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

export default function VerifyRoute() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const submittedRef = useRef(false);
  const { token } = useLocalSearchParams<{ token?: string }>();

  const pendingTrustrootsUsername = useAppSelector(
    settingsSelectors.selectPendingTrustrootsUsername,
  );
  const pendingTrustrootsProfileUsername = useAppSelector(
    settingsSelectors.selectPendingTrustrootsProfileUsername,
  );

  useEffect(() => {
    if (submittedRef.current) {
      return;
    }

    submittedRef.current = true;

    async function completeVerification() {
      if (!token) {
        router.replace("/onboarding/trustroots?error=missing-token");
        return;
      }

      if (pendingTrustrootsProfileUsername) {
        try {
          await finalizeTrustrootsProfilePublish(
            pendingTrustrootsProfileUsername,
            dispatch,
          );
          router.replace("/onboarding/backup-confirm?from=bridge");
        } catch (error) {
          console.error("Failed to retry Trustroots profile publish", error);
          router.replace("/onboarding/trustroots");
        }
        return;
      }

      if (!pendingTrustrootsUsername) {
        router.replace("/onboarding/trustroots?error=start-in-app");
        return;
      }

      try {
        const { npub } = await ensureOnboardingIdentity(dispatch);
        await authenticateWithToken({
          username: pendingTrustrootsUsername,
          npub,
          token,
        });
        await finalizeTrustrootsProfilePublish(
          pendingTrustrootsUsername,
          dispatch,
        );
        router.replace("/onboarding/backup-confirm?from=bridge");
      } catch (error) {
        console.error("Failed to authenticate Trustroots deep link", error);
        router.replace("/onboarding/trustroots?error=auth");
      }
    }

    completeVerification();
  }, [
    dispatch,
    pendingTrustrootsProfileUsername,
    pendingTrustrootsUsername,
    router,
    token,
  ]);

  return <LoadingScreen loading={true} />;
}
