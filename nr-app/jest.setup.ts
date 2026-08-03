// Jest setup - mocks for native modules

import AsyncStorage from "@react-native-async-storage/async-storage";

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

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

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

jest.mock("expo-secure-store", () =>
  require("./src/test/secureStoreMock").createSecureStoreMock(),
);

jest.mock("expo-device", () =>
  require("./src/test/expoDeviceMock").createExpoDeviceMock(),
);

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    easConfig: { projectId: "test-project-id" },
    expoConfig: { extra: { eas: { projectId: "test-project-id" } } },
  },
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3, High: 4 },
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 52.52, longitude: 13.405 },
    timestamp: 0,
  })),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({
    status: "granted",
  })),
}));

jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(async () => ({ type: "opened" })),
}));

jest.mock("expo-clipboard", () => ({
  getStringAsync: jest.fn(async () => ""),
  setStringAsync: jest.fn(async () => undefined),
}));

jest.mock("react-native-root-toast", () => ({
  show: jest.fn(),
  durations: {
    SHORT: 1000,
    LONG: 3500,
  },
  positions: {
    BOTTOM: -20,
  },
}));

jest.mock("react-native-webview", () => {
  return {
    __esModule: true,
    default: "WebView",
  };
});

// Mock @maplibre/maplibre-react-native (v11 named exports)
jest.mock("@maplibre/maplibre-react-native", () => ({
  __esModule: true,
  Map: "Map",
  Camera: "Camera",
  GeoJSONSource: "GeoJSONSource",
  Layer: "Layer",
  Images: "Images",
  Marker: "Marker",
  UserLocation: "UserLocation",
}));

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View },
    FadeIn: { delay: jest.fn(() => ({})), duration: jest.fn(() => ({})) },
    FadeOut: { duration: jest.fn(() => ({})) },
    useAnimatedStyle: jest.fn(() => ({})),
    useSharedValue: jest.fn((value) => ({ value })),
  };
});

jest.mock("react-native-worklets", () => ({}));

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
