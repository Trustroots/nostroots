import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

import { nip19 } from "nostr-tools";

import LoadingScreen from "@/components/LoadingModal";
import { ROUTES } from "@/constants/routes";
import { getPublicKeyHexFromSecureStorage } from "@/nostr/keystore.nostr";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  keystoreSelectors,
  setPublicKeyHex,
} from "@/redux/slices/keystore.slice";
import {
  selectFeatureFlags,
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";
import { getNip5PubKey } from "@trustroots/nr-common";

export default function IndexRoute() {
  const dispatch = useAppDispatch();

  // Redux state
  const isSettingsDataLoaded = useAppSelector(
    settingsSelectors.selectIsDataLoaded,
  );
  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub);
  const username = useAppSelector(settingsSelectors.selectUsername);
  const hasBeenOpenedBefore = useAppSelector(
    settingsSelectors.selectHasBeenOpenedBefore,
  );
  const { forceOnboarding, forceWelcome } = useAppSelector(selectFeatureFlags);

  // NIP-5 verification state
  const [verificationDone, setVerificationDone] = useState(false);
  const [nip5Error, setNip5Error] = useState(false);

  // Run verification once settings are loaded
  useEffect(() => {
    if (!isSettingsDataLoaded) return;

    let cancelled = false;

    async function runVerification() {
      if (!username || !npub) {
        if (!cancelled) setVerificationDone(true);
        return;
      }

      let error = false;

      if (!npub) {
        const result = await getPublicKeyHexFromSecureStorage();
        if (result) {
          dispatch(
            setPublicKeyHex({
              hasMnemonic: result.hasMnemonicInSecureStorage,
              publicKeyHex: result.publicKeyHex,
            }),
          );
        } else {
          error = true;
        }
      }

      const nip5Result = await getNip5PubKey(username);

      let npubResponse;
      if (nip5Result) {
        npubResponse = nip19.npubEncode(nip5Result);
      }

      if (npubResponse !== npub || !nip5Result) {
        error = true;
      }

      if (!cancelled) {
        if (error) {
          setNip5Error(true);
        }
        setVerificationDone(true);
      }
    }

    runVerification();

    return () => {
      cancelled = true;
    };
  }, [isSettingsDataLoaded, username, npub, dispatch]);

  // Mark app as opened on first redirect
  useEffect(() => {
    if (isSettingsDataLoaded && verificationDone && !hasBeenOpenedBefore) {
      dispatch(settingsActions.setHasBeenOpenedBefore(true));
    }
  }, [isSettingsDataLoaded, verificationDone, hasBeenOpenedBefore, dispatch]);

  // Show loading while determining destination
  if (!isSettingsDataLoaded || !verificationDone) {
    return <LoadingScreen loading={true} />;
  }

  // Determine destination
  const showWelcome = !hasBeenOpenedBefore || forceWelcome;
  const showOnboarding = !username || !npub || nip5Error || forceOnboarding;

  if (showWelcome) {
    return <Redirect href={ROUTES.WELCOME} />;
  }

  if (showOnboarding) {
    return (
      <Redirect
        href={nip5Error ? ROUTES.ONBOARDING_ERROR : ROUTES.ONBOARDING}
      />
    );
  }

  return <Redirect href={ROUTES.HOME} />;
}
