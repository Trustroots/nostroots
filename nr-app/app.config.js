module.exports = ({ config }) => {
  const commitId = process.env.EAS_BUILD_GIT_COMMIT_HASH;
  const nrBridgeBaseUrl = process.env.EXPO_PUBLIC_NR_BRIDGE_BASE_URL;

  return {
    ...config,
    scheme: "nostroots",
    extra: {
      ...config.extra,
      commitId,
      nrBridgeBaseUrl,
    },
  };
};
