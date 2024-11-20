// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const extraConfig = {
  watchFolders: [path.resolve(`${__dirname}/../nr-common/`)],
};

const mergedConfig = { ...config, ...extraConfig };

module.exports = mergedConfig;
