import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from "react-native-maps";

/**
 * Determines the appropriate map provider based on platform and build environment.
 *
 * Logic:
 * - iOS (all builds): PROVIDER_DEFAULT (Apple Maps)
 * - Android development/preview: PROVIDER_DEFAULT (Google Maps via native)
 * - Android store builds: PROVIDER_GOOGLE (explicit Google Maps)
 *
 * @returns The map provider constant for react-native-maps
 */
export const getMapProvider = ():
  | typeof PROVIDER_DEFAULT
  | typeof PROVIDER_GOOGLE => {
  const isStoreBuild =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const isAndroid = Platform.OS === "android";

  // Use explicit Google Maps provider only for Android store builds
  return isStoreBuild && isAndroid ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
};

/**
 * Map provider configuration constants
 */
export const MAP_CONFIG = {
  /** The computed map provider for the current platform/environment */
  PROVIDER: getMapProvider(),
} as const;
