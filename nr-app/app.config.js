module.exports = ({ config }) => {
  const commitId = process.env.EAS_BUILD_GIT_COMMIT_HASH;
  const nrBridgeBaseUrl = "https://auth.trustroots.org";

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
