const transformIgnorePatterns = [
  "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|react-redux|@rn-primitives/.*|@trustroots/nr-common|@reduxjs/toolkit|immer|redux-persist|redux-devtools-expo-dev-plugin|nostr-tools|@noble/.*|@scure/.*)",
];

/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["./jest.setup.ts"],
  transformIgnorePatterns,
  moduleNameMapper: {
    "^@noble/hashes/utils$": "<rootDir>/../node_modules/@noble/hashes/utils.js",
  },
  collectCoverageFrom: [
    "app/**/*.{ts,tsx}",
    "src/**/*.{ts,tsx}",
    "!**/*.test.{ts,tsx,js,jsx}",
    "!**/*.spec.{ts,tsx,js,jsx}",
    "!**/*.d.ts",
    "!expo-env.d.ts",
    "!nativewind-env.d.ts",
    "!app/+html.tsx",
    "!app/+not-found.tsx",
    "!src/reactotron.config.ts",
    "!src/index.ts",
    "!src/components/ui/native-only-animated-view.tsx",
    "!src/components/Map.web.tsx",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text-summary", "lcov", "json-summary"],
  coverageThreshold: {
    global: {
      statements: 40,
      branches: 35,
      functions: 35,
      lines: 40,
    },
  },
};
