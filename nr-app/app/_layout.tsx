import { getPublicKeyHexFromSecureStorage } from "@/nostr/keystore.nostr";

import { nip19 } from "nostr-tools";

import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { getNip5PubKey } from "@trustroots/nr-common";

import * as Sentry from "@sentry/react-native";
import { isRunningInExpoGo } from "expo";
import { useFonts } from "expo-font";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { useCallback, useEffect, useState } from "react";
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
import { setupNotificationHandling } from "@/startup/notifications.startup";
import { PortalHost } from "@rn-primitives/portal";
import { SENTRY_DSN } from "@trustroots/nr-common";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import OnboardModal from "@/components/OnboardModal";
import WelcomeScreen from "@/components/WelcomeModal";
import { colorScheme } from "nativewind";

import {
  selectFeatureFlags,
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";

import { persistor, store } from "@/redux/store";

import "@/global.css";
import { useUpdateOnForeground } from "@/hooks/useUpdateOnForeground";

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
/** @todo When the new onboarding is approved, remove all the feature flag logic here. */
function AppContent() {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [onboardVisible, setOnboardVisible] = useState(false);
  const [onboardModalStep, setOnboardModalStep] = useState("isUserScreen");
  const [nip5VerificationLoaded, setNip5VerificationLoaded] = useState(false);
  const [nip5Error, setNip5Error] = useState<boolean | string | null>(null);

  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub);

  const username = useAppSelector(settingsSelectors.selectUsername);
  const hasBeenOpenedBefore = useAppSelector(
    settingsSelectors.selectHasBeenOpenedBefore,
  );

  // Get the settings loading state
  const isSettingsDataLoaded = useAppSelector(
    settingsSelectors.selectIsDataLoaded,
  );

  // Onboarding feature flags and force toggles.
  const { useNewOnboarding, forceOnboarding, forceWelcome } =
    useAppSelector(selectFeatureFlags);

  // Initializes user data and performs NIP-5 verification
  const initUserAndVerify = useCallback(async () => {
    if (useNewOnboarding) {
      if (!username || !npub) {
        setNip5VerificationLoaded(true);
        setOnboardVisible(true);
        return;
      }
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

    if (!username) {
      error = true;
    } else {
      const nip5Result = await getNip5PubKey(username);

      let npubResponse;
      if (nip5Result) {
        npubResponse = nip19.npubEncode(nip5Result);
      }

      if (npubResponse !== npub || !nip5Result) {
        error = true;
      }
    }

    setNip5VerificationLoaded(true);

    if (error) {
      setNip5Error(error);

      if (!useNewOnboarding) {
        setOnboardVisible(true);
        setOnboardModalStep("accountErrorScreen");
      }
    }
  }, [npub, username, dispatch]);

  // First-run behavior: Set the welcome and onboarding modals
  // based on whether the app has been opened before
  useEffect(() => {
    if (!hasBeenOpenedBefore || forceWelcome) {
      setWelcomeVisible(true);
    }

    if (!hasBeenOpenedBefore || forceOnboarding) {
      setOnboardVisible(true);
    }

    if (!hasBeenOpenedBefore) {
      dispatch(settingsActions.setHasBeenOpenedBefore(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, hasBeenOpenedBefore]);

  // Initialize user data and perform NIP-5 verification
  // when username or npub changes
  useEffect(() => {
    initUserAndVerify();
  }, [initUserAndVerify, username, npub]);

  // Redirect to onboarding if needed
  useEffect(() => {
    if (
      pathname.startsWith("/onboarding") ||
      (!onboardVisible && !nip5Error) ||
      !useNewOnboarding
    ) {
      return;
    }

    router.replace(nip5Error ? "/onboarding/error" : "/onboarding");
    setOnboardVisible(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardVisible, nip5Error]);

  // Determine if the loading modal should be visible
  const showLoadingModal = !isSettingsDataLoaded || !nip5VerificationLoaded;

  if (showLoadingModal) {
    return <LoadingScreen loading={true} />;
  }

  return (
    <RootSiblingParent>
      <GestureHandlerRootView>
        {welcomeVisible ? (
          <WelcomeScreen onClose={() => setWelcomeVisible(false)} />
        ) : onboardVisible && !useNewOnboarding ? (
          <OnboardModal
            setModalVisible={setOnboardVisible}
            step={onboardModalStep}
          />
        ) : (
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        )}
      </GestureHandlerRootView>
    </RootSiblingParent>
  );
}

function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useUpdateOnForeground();

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
