import { getPublicKeyHexFromSecureStorage } from "@/nostr/keystore.nostr";

import { nip19 } from "nostr-tools";

import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { getNip5PubKey } from "@trustroots/nr-common";

import * as Sentry from "@sentry/react-native";
import { isRunningInExpoGo } from "expo";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import { RootSiblingParent } from "react-native-root-siblings";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

import LoadingScreen from "@/components/LoadingModal";
import { rehydrated } from "@/redux/actions/startup.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  keystoreSelectors,
  setPublicKeyHex,
} from "@/redux/slices/keystore.slice";
import { setupNotificationHandling } from "@/utils/notifications.utils";
import { PortalHost } from "@rn-primitives/portal";
import { SENTRY_DSN } from "@trustroots/nr-common";

import OnboardModal from "@/components/OnboardModal";
import WelcomeScreen from "@/components/WelcomeModal";
import { colorScheme } from "nativewind";

import {
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";

import { persistor, store } from "@/redux/store";

import "@/global.css";

// Construct a new integration instance. This is needed to communicate between the integration and React
const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
  dsn: SENTRY_DSN,
  debug: false,
  enabled: !__DEV__, // Disable sentry in development
  tracesSampleRate: 1.0, // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing. Adjusting this value in production.
  integrations: [
    // Pass integration
    navigationIntegration,
  ],
  enableNativeFramesTracking: !isRunningInExpoGo(), // Tracks slow and frozen frames in the application
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Child component that contains all Redux-dependent code
function AppContent() {
  const dispatch = useAppDispatch();
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [onboardVisible, setOnboardVisible] = useState(false);
  const [nip5VerificationLoaded, setNip5VerificationLoaded] = useState(false);
  const [onboardModalStep, setOnboardModalStep] = useState("isUserScreen");

  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub);
  // const pubHex = useAppSelector(keystoreSelectors.selectPublicKeyHex);

  const username = useAppSelector(settingsSelectors.selectUsername);
  const hasBeenOpenedBefore = useAppSelector(
    settingsSelectors.selectHasBeenOpenedBefore,
  );

  // Get the settings loading state
  const isSettingsDataLoaded = useAppSelector(
    settingsSelectors.selectIsDataLoaded,
  );

  // use effect to see if this is the first time app has opened
  useEffect(() => {
    if (!hasBeenOpenedBefore) {
      setWelcomeVisible(true);
      setOnboardVisible(true);
      dispatch(settingsActions.setHasBeenOpenedBefore(true));
    }
  }, [dispatch, hasBeenOpenedBefore]);

  useEffect(() => {
    (async function initUserAndVerify() {
      // there is no public key from the redux store
      if (!npub) {
        const publicKeyHexResult = await getPublicKeyHexFromSecureStorage();

        const hasPrivateKeyAvailable =
          typeof publicKeyHexResult !== "undefined";

        if (hasPrivateKeyAvailable) {
          dispatch(
            setPublicKeyHex({
              hasMnemonic: publicKeyHexResult.hasMnemonicInSecureStorage,
              publicKeyHex: publicKeyHexResult.publicKeyHex,
            }),
          );
          return;
        } else {
          // TODO: set onboard modal: no private key found
          setOnboardModalStep("accountErrorScreen");
          setNip5VerificationLoaded(true);
          setOnboardVisible(true);
          return;
        }
      }

      if (isSettingsDataLoaded) {
        if (
          hasBeenOpenedBefore &&
          username &&
          npub &&
          nip5VerificationLoaded === false
        ) {
          const nip5Result = await getNip5PubKey(username);

          if (nip5Result) {
            const npubResponse = nip19.npubEncode(nip5Result);
            if (npubResponse === npub) {
              // don't show modal
              setOnboardVisible(false);
              setNip5VerificationLoaded(true);
              return;
            }
          }
        }

        // TODO: set state of onboard modal depending on nip5 result
        //for example: no username, bad nip5 etc.
        setOnboardModalStep("accountErrorScreen");
        setOnboardVisible(true);
        setNip5VerificationLoaded(true);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSettingsDataLoaded, npub, hasBeenOpenedBefore]);

  // Determine if the loading modal should be visible
  const showLoadingModal = !isSettingsDataLoaded || !nip5VerificationLoaded;

  return (
    <>
      <RootSiblingParent>
        {showLoadingModal ? (
          <LoadingScreen loading={true} />
        ) : welcomeVisible ? (
          <WelcomeScreen onClose={() => setWelcomeVisible(false)} />
        ) : onboardVisible ? (
          <OnboardModal
            setModalVisible={setOnboardVisible}
            step={onboardModalStep}
          />
        ) : (
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        )}
      </RootSiblingParent>
    </>
  );
}

function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    colorScheme.set("light");

    const subscription = setupNotificationHandling();

    if (loaded) {
      SplashScreen.hideAsync();
    }

    return () => {
      subscription.remove();
    };
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <Provider store={store}>
      <PersistGate
        loading={null}
        persistor={persistor}
        onBeforeLift={() => {
          // Dispatch startup action after redux-persist has rehydrated the store
          store.dispatch(rehydrated());
          // This is called right before the persisted state is applied to Redux
          store.dispatch(settingsActions.setDataLoaded(true));
        }}
      >
        <ThemeProvider
          value={DefaultTheme}
          // value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <AppContent />
          <PortalHost />
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
}

// Wrap the Root Layout route component with `Sentry.wrap` to capture gesture info and profiling data.
export default Sentry.wrap(RootLayout);
