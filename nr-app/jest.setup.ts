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
  Redirect: jest.fn(() => null),
  Slot: ({ children }: { children?: unknown }) => children,
  Stack: {
    Screen: () => null,
  },
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
  usePathname: jest.fn(() => "/"),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(callback, [callback]);
  },
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
}));

// Mock react-native-maps
jest.mock("react-native-maps", () => ({
  __esModule: true,
  default: "MapView",
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

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();

  return {
    AFTER_FIRST_UNLOCK: 1,
    __reset: () => store.clear(),
    __store: store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

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

// Mock redux-devtools-expo-dev-plugin
jest.mock("redux-devtools-expo-dev-plugin", () => ({
  __esModule: true,
  default: () => (next: unknown) => next,
}));
