module.exports = ({ config }) => {
  const commitId = process.env.EAS_BUILD_GIT_COMMIT_HASH;
  return {
    ...config,
    extra: {
      ...config.extra,
      commitId,
    },
  };
};
