// Learn more https://docs.expo.dev/guides/monorepos
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

// This replaces `const config = getDefaultConfig(__dirname);`
const config = getSentryExpoConfig(__dirname);

// Since we are using pnpm, we have to setup the monorepo manually for Metro
// #1 - Watch all files in the monorepo
config.watchFolders = [workspaceRoot];
// #2 - Try resolving with project modules first, then workspace modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Disable package exports support to fix Redux Saga compatibility with React Native 0.79
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
