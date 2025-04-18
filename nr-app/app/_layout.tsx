import {
  derivePublicKeyHexFromMnemonic,
  getHasPrivateKeyInSecureStorage,
  getPrivateKeyMnemonic,
} from "@/nostr/keystore.nostr";

import { nip19 } from "nostr-tools";

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { getNip5PubKey } from "@trustroots/nr-common";

import { setPrivateKeyMnemonicPromiseAction } from "@/redux/sagas/keystore.saga";

import * as Sentry from "@sentry/react-native";
import { isRunningInExpoGo } from "expo";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import "react-native-reanimated";
import { RootSiblingParent } from "react-native-root-siblings";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

import { SENTRY_DSN } from "@trustroots/nr-common";

import LoadingScreen from "@/components/LoadingModal";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  keystoreSelectors,
  setPublicKeyHex,
} from "@/redux/slices/keystore.slice";

import OnboardModal from "@/components/OnboardModal";
import WelcomeScreen from "@/components/WelcomeModal";

import {
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";

import { persistor, store } from "@/redux/store";

// Construct a new integration instance. This is needed to communicate between the integration and React
const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
  dsn: SENTRY_DSN,
  debug: __DEV__, // If `true`, Sentry will try to print out useful debugging information if something goes wrong with sending the event. Set it to `false` in production
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
  const [nip5VerificationLoading, setNip5VerificationLoading] = useState(true);
  const [onboardModalStep, setOnboardModalStep] = useState("isUserScreen");

  const hasPrivateKeyFromRedux = useAppSelector(
    keystoreSelectors.selectHasPrivateKeyInSecureStorage,
  );

  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub);
  // const pubHex = useAppSelector(keystoreSelectors.selectPublicKeyHex);

  const username = useAppSelector(settingsSelectors.selectUsername);
  const hasBeenOpenedBefore = useAppSelector(
    settingsSelectors.selectHasBeenOpenedBefore,
  );

  // Get the keystore loading state
  const isKeystoreLoading = useAppSelector(keystoreSelectors.selectIsLoading);

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
    // setOnboardModalStep("foobar");
  }, [dispatch, hasBeenOpenedBefore]);

  useEffect(() => {
    // case for some reason keys are set even if user key isnt in redux
    (async function hydrateKeys() {
      const hasKeyFromStorage = await getHasPrivateKeyInSecureStorage();

      // if we don't have it in redux
      if (hasKeyFromStorage && !hasPrivateKeyFromRedux) {
        const mnemonic = await getPrivateKeyMnemonic();

        dispatch(setPrivateKeyMnemonicPromiseAction.request(mnemonic));
        const pubKeyHex = derivePublicKeyHexFromMnemonic(mnemonic);
        dispatch(setPublicKeyHex(pubKeyHex));
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKeystoreLoading]);

  useEffect(() => {
    (async function userVerify() {
      if (
        hasBeenOpenedBefore &&
        username &&
        npub &&
        nip5VerificationLoading === false
      ) {
        const nip5Result = await getNip5PubKey(username);

        if (nip5Result) {
          const npubResponse = nip19.npubEncode(nip5Result);
          if (npubResponse === npub) {
            // don't show modal
            setOnboardVisible(false);
          }
        }

        // todo: special screens if the users nip5 fails
        // setOnboardModalStep("usernameScreen");
        setNip5VerificationLoading(false);
        setOnboardVisible(true);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSettingsDataLoaded, isKeystoreLoading, npub, hasBeenOpenedBefore]);

  // Determine if the loading modal should be visible
  // Show if data is loading
  const showLoadingModal =
    isKeystoreLoading || !isSettingsDataLoaded || !nip5VerificationLoading;
  // const showLoadingModal = true;

  // Handle loading completion
  const handleLoadingComplete = () => {
    // Any actions needed when loading is complete
    console.log("Loading complete");
  };

  return (
    <>
      <RootSiblingParent>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </RootSiblingParent>

      <LoadingScreen loading={showLoadingModal} zIndex={999} />
      <WelcomeScreen
        visible={welcomeVisible}
        zIndex={899}
        onClose={() => setWelcomeVisible(false)}
      />
      {onboardVisible && (
        <View style={styles.fullScreenOverlay}>
          <OnboardModal
            setModalVisible={setOnboardVisible}
            step={onboardModalStep}
          />
        </View>
      )}
    </>
  );
}

function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
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
          // This is called right before the persisted state is applied to Redux
          store.dispatch(settingsActions.setDataLoaded(true));
        }}
      >
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <AppContent />
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
}

// Wrap the Root Layout route component with `Sentry.wrap` to capture gesture info and profiling data.
export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  fullScreenOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
});
