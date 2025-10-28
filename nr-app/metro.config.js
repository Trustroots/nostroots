// Learn more https://docs.expo.dev/guides/monorepos
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// This replaces `const config = getDefaultConfig(__dirname);`
const config = getSentryExpoConfig(__dirname);

// Disable package exports support to fix Redux Saga compatibility with React Native 0.79
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
