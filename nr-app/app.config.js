module.exports = ({ config }) => {
  const commitId = process.env.EAS_BUILD_GIT_COMMIT_HASH;
  const nrBridgeBaseUrl = process.env.EXPO_PUBLIC_NR_BRIDGE_BASE_URL;
  const isE2eBuild = process.env.EXPO_PUBLIC_E2E === "1";

  return {
    ...config,
    scheme: "nostroots",
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        // The Maestro mock stack is served over plaintext on localhost.
        ...(isE2eBuild
          ? { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } }
          : {}),
      },
    },
    extra: {
      ...config.extra,
      commitId,
      nrBridgeBaseUrl,
    },
  };
};
