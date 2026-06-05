/* eslint-disable @typescript-eslint/no-require-imports, react/display-name */

jest.mock("react-native", () => {
  const React = require("react");

  const component = (name: string) =>
    React.forwardRef(({ children, ...props }: Record<string, unknown>, ref: unknown) =>
      React.createElement(name, { ...props, ref }, children),
    );

  return {
    ActivityIndicator: component("ActivityIndicator"),
    Alert: {
      alert: jest.fn(),
    },
    Linking: {
      openURL: jest.fn(async () => true),
    },
    Modal: ({ children, visible }: { children: React.ReactNode; visible?: boolean }) =>
      visible ? React.createElement("Modal", null, children) : null,
    Pressable: component("Pressable"),
    ScrollView: component("ScrollView"),
    StatusBar: {
      setHidden: jest.fn(),
    },
    Switch: component("Switch"),
    Text: component("Text"),
    TextInput: component("TextInput"),
    View: component("View"),
    StyleSheet: {
      flatten: (style: unknown) => style,
    },
    Platform: {
      OS: "ios",
      select: (values: Record<string, unknown>) => values.ios ?? values.default,
    },
  };
});

jest.mock("expo-clipboard", () => ({
  getStringAsync: jest.fn(async () => ""),
  setStringAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        buildTime: "2026-06-02T15:04:00",
      },
    },
  },
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

jest.mock("react-native-get-random-values", () => {
  const nodeCrypto = require("crypto");
  const globalAny = global as any;

  if (!globalAny.crypto) {
    globalAny.crypto = {};
  }
  globalAny.crypto.getRandomValues = (array: Uint8Array) => {
    nodeCrypto.randomFillSync(array);
    return array;
  };

  return {};
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");

  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
  };
});

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { Text } = require("react-native");

  function Icon({ testID }: { testID?: string }) {
    return React.createElement(Text, { testID }, "icon");
  }

  return {
    Copy: Icon,
    Eye: Icon,
    EyeOff: Icon,
    Home: Icon,
    KeyRound: Icon,
    Link: Icon,
    Settings: Icon,
    ShieldCheck: Icon,
    Sparkles: Icon,
    Trash2: Icon,
    X: Icon,
  };
});

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    __esModule: true,
    default: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({
        injectJavaScript: jest.fn(),
        reload: jest.fn(),
      }));
      return React.createElement(View, {
        ...props,
        testID: props.testID || "nostroots-webview",
      });
    }),
  };
});
