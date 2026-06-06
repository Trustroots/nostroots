// Jest setup - mocks for native modules

// Mock expo-notifications
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  getExpoPushTokenAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Mock expo-router
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock react-native-maps
jest.mock("react-native-maps", () => ({
  __esModule: true,
  default: "MapView",
}));

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

// Mock redux-devtools-expo-dev-plugin
jest.mock("redux-devtools-expo-dev-plugin", () => ({
  __esModule: true,
  default: () => (next: unknown) => next,
}));
