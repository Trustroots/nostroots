import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { KeyboardProvider } from "react-native-keyboard-controller";

import * as Sentry from "@sentry/react-native";
import { isRunningInExpoGo } from "expo";
import { useFonts } from "expo-font";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import { RootSiblingParent } from "react-native-root-siblings";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

import { rehydrated } from "@/redux/actions/startup.actions";
import { setupNotificationHandling } from "@/services/notifications.service";
import { PortalHost } from "@rn-primitives/portal";
import { SENTRY_DSN } from "@trustroots/nr-common";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import {
  colorScheme as nativewindColorScheme,
  useColorScheme,
} from "nativewind";

import { useAppSelector } from "@/redux/hooks";
import {
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";

import { persistor, store } from "@/redux/store";

import "@/global.css";
import { useUpdateOnForeground } from "@/hooks/useUpdateOnForeground";
import { StatusBar } from "react-native";

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

const FORCE_LIGHT_MODE_ROUTES = ["/onboarding"];

// Child component that contains all Redux-dependent code
function AppContent() {
  const pathname = usePathname();
  const { colorScheme } = useColorScheme();
  const colorSchemePreference = useAppSelector(
    settingsSelectors.selectColorScheme,
  );

  useEffect(() => {
    const forceLightMode = FORCE_LIGHT_MODE_ROUTES.some((route) =>
      pathname?.startsWith(route),
    );

    if (forceLightMode) {
      nativewindColorScheme.set("light");
    } else if (colorSchemePreference === "system") {
      nativewindColorScheme.set("system");
    } else {
      nativewindColorScheme.set(colorSchemePreference);
    }
  }, [colorSchemePreference, pathname]);

  return (
    <RootSiblingParent>
      <GestureHandlerRootView>
        <StatusBar
          barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
        />
        <Stack screenOptions={{ headerShown: false }} />
      </GestureHandlerRootView>
    </RootSiblingParent>
  );
}

function RootLayout() {
  const { colorScheme } = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useUpdateOnForeground();

  useEffect(() => {
    const subscription = setupNotificationHandling();
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    SplashScreen.hideAsync();
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
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <KeyboardProvider>
            <AppContent />
          </KeyboardProvider>
          <PortalHost />
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
}

// Wrap the Root Layout route component with `Sentry.wrap` to capture gesture info and profiling data.
export default Sentry.wrap(RootLayout);
