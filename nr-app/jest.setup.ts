// Jest setup - mocks for native modules

import AsyncStorage from "@react-native-async-storage/async-storage";
import type React from "react";

// Mock expo-notifications
jest.mock("expo-notifications", () => ({
  AndroidImportance: { MAX: "max" },
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  getExpoPushTokenAsync: jest.fn(),
  getLastNotificationResponse: jest.fn(() => null),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock Expo native modules
jest.mock("expo-clipboard", () => ({
  getStringAsync: jest.fn(async () => ""),
  setStringAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    easConfig: { projectId: "test-project-id" },
    expoConfig: {
      extra: {
        eas: { projectId: "test-project-id" },
      },
    },
  },
}));

jest.mock("expo-device", () =>
  require("./src/test/expoDeviceMock").createExpoDeviceMock(),
);

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3, High: 4 },
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: {
      accuracy: 1,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude: 52.52,
      longitude: 13.405,
      speed: null,
    },
    timestamp: 0,
  })),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({
    status: "granted",
  })),
}));

jest.mock("expo-secure-store", () =>
  require("./src/test/secureStoreMock").createSecureStoreMock(),
);

jest.mock("expo-updates", () => ({
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(async () => ({ isNew: false })),
  reloadAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(async () => ({ type: "opened" })),
}));

jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  reactNavigationIntegration: jest.fn(() => ({})),
  wrap: (component: unknown) => component,
}));

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Mock expo-router
jest.mock("expo-router", () =>
  require("./src/test/router").createExpoRouterMock(),
);

// Mock react-native-maps
jest.mock("react-native-maps", () => ({
  __esModule: true,
  default: "MapView",
  Callout: "Callout",
  Circle: "Circle",
  Marker: "Marker",
  Polygon: "Polygon",
  Polyline: "Polyline",
}));

jest.mock("@gorhom/bottom-sheet", () => ({
  __esModule: true,
  BottomSheetModal: "BottomSheetModal",
  BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  BottomSheetTextInput: "BottomSheetTextInput",
  default: "BottomSheet",
}));

jest.mock("react-native-keyboard-controller", () => ({
  KeyboardAwareScrollView: "KeyboardAwareScrollView",
  KeyboardProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock("react-native-root-toast", () => {
  const toast = {
    durations: { LONG: 3500, SHORT: 2000 },
    positions: { BOTTOM: -20, TOP: 20 },
    show: jest.fn(),
  };

  return {
    __esModule: true,
    default: toast,
    ...toast,
  };
});

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      View,
    },
    FadeIn: { delay: jest.fn(() => ({})), duration: jest.fn(() => ({})) },
    FadeOut: { duration: jest.fn(() => ({})) },
    useAnimatedStyle: jest.fn(() => ({})),
    useSharedValue: jest.fn((value) => ({ value })),
  };
});

jest.mock("react-native-worklets", () => ({}));

jest.mock("redux-persist/integration/react", () => ({
  PersistGate: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@expo/vector-icons/Ionicons", () => ({
  __esModule: true,
  default: "Ionicons",
}));

jest.mock("@expo/vector-icons", () => ({
  __esModule: true,
  FontAwesome: "FontAwesome",
}));

jest.mock("@rn-primitives/slot", () => ({
  Text: "Text",
}));

jest.mock("react-native-webview", () => {
  return {
    __esModule: true,
    default: "WebView",
  };
});

// Mock redux-devtools-expo-dev-plugin
jest.mock("redux-devtools-expo-dev-plugin", () => ({
  __esModule: true,
  default: () => (next: unknown) => next,
}));

beforeEach(async () => {
  require("./src/test/router").resetRouterMock();
  require("./src/test/secureStoreMock").resetSecureStoreMock();
  require("./src/test/expoDeviceMock").resetExpoDeviceMock();
  await AsyncStorage.clear();
});
