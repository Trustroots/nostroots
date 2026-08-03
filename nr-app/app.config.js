module.exports = ({ config }) => {
  const commitId = process.env.EAS_BUILD_GIT_COMMIT_HASH;
  const nrBridgeBaseUrl = process.env.EXPO_PUBLIC_NR_BRIDGE_BASE_URL;
  const noGoogleServices =
    process.env.EXPO_PUBLIC_NO_GOOGLE_SERVICES === "true";

  return {
    ...config,
    scheme: "nostroots",
    android: {
      ...config.android,
      googleServicesFile: noGoogleServices
        ? "./google-services-stub.json"
        : "./google-services.json",
    },
    extra: {
      ...config.extra,
      commitId,
      nrBridgeBaseUrl,
    },
  };
};
