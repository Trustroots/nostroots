const appJson = require("./app.json");

module.exports = ({ config }) => {
  const baseConfig = Object.keys(config || {}).length ? config : appJson.expo;
  const buildTime =
    process.env.NOSTROOTS_BROWSER_BUILD_TIME || new Date().toISOString();

  return {
    ...baseConfig,
    ios: {
      ...baseConfig.ios,
      infoPlist: {
        ...baseConfig.ios?.infoPlist,
        NostrootsBuildTime: buildTime,
      },
    },
    extra: {
      ...baseConfig.extra,
      buildTime,
      router: {
        origin: false,
        ...baseConfig.extra?.router,
      },
    },
  };
};
