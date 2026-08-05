const e2eDevClientUrl =
  process.env.EXPO_PUBLIC_DEV_CLIENT_URL ??
  (process.env.EXPO_PUBLIC_NR_BRIDGE_BASE_URL?.includes("10.0.2.2")
    ? "http://10.0.2.2:8081?disableOnboarding=1"
    : "http://127.0.0.1:8081?disableOnboarding=1");

function withE2EDevClient(config) {
  if (process.env.EXPO_PUBLIC_E2E !== "1") return config;

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []).filter((plugin) =>
        Array.isArray(plugin)
          ? plugin[0] !== "expo-dev-client"
          : plugin !== "expo-dev-client",
      ),
      [
        "expo-dev-client",
        {
          defaultLaunchURL: e2eDevClientUrl,
          launchMode: "most-recent",
          showMenuAtLaunch: false,
          skipOnboarding: true,
          toolsButton: false,
        },
      ],
    ],
  };
}

module.exports = ({ config }) => {
  const commitId = process.env.EAS_BUILD_GIT_COMMIT_HASH;
  const nrBridgeBaseUrl = process.env.EXPO_PUBLIC_NR_BRIDGE_BASE_URL;

  return withE2EDevClient({
    ...config,
    scheme: "nostroots",
    extra: {
      ...config.extra,
      commitId,
      nrBridgeBaseUrl,
    },
  });
};
