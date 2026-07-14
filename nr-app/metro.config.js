// Learn more https://docs.expo.dev/guides/monorepos
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");

// This replaces `const config = getDefaultConfig(__dirname);`
const config = getSentryExpoConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

// Keep colocated test files (e.g. app/.../*.test.tsx) out of the app bundle.
// Expo Router's require.context otherwise treats them as routes, pulling in
// test-only deps like @testing-library/react-native that import Node builtins.
// Jest uses its own resolver, so excluding them here doesn't affect tests.
const testFilePattern = /.*\.(test|spec)\.[jt]sx?$/;
const existingBlockList = config.resolver.blockList;
const existingBlockListPatterns = existingBlockList
  ? Array.isArray(existingBlockList)
    ? existingBlockList
    : [existingBlockList]
  : [];
config.resolver.blockList = new RegExp(
  [...existingBlockListPatterns, testFilePattern]
    .map((pattern) => pattern.source)
    .join("|"),
);

module.exports = withNativeWind(config, {
  input: "./src/global.css",
  inlineRem: 16,
});
