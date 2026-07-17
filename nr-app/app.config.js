const e2eDevClientUrl =
  process.env.EXPO_PUBLIC_DEV_CLIENT_URL ??
  (process.env.EXPO_PUBLIC_NR_BRIDGE_BASE_URL?.includes("10.0.2.2")
    ? "http://10.0.2.2:8081?disableOnboarding=1"
    : "http://127.0.0.1:8081?disableOnboarding=1");

const E2E_DEV_CLIENT_OPTIONS = {
  defaultLaunchURL: e2eDevClientUrl,
  launchMode: "most-recent",
  showMenuAtLaunch: false,
  skipOnboarding: true,
  toolsButton: false,
};

function withE2EDevClientOptions(config) {
  if (process.env.EXPO_PUBLIC_E2E !== "1") {
    return config;
  }

  let foundDevClient = false;
  const plugins = (config.plugins ?? []).map((plugin) => {
    if (plugin === "expo-dev-client") {
      foundDevClient = true;
      return ["expo-dev-client", E2E_DEV_CLIENT_OPTIONS];
    }

    if (Array.isArray(plugin) && plugin[0] === "expo-dev-client") {
      foundDevClient = true;
      return [
        "expo-dev-client",
        {
          ...(plugin[1] ?? {}),
          ...E2E_DEV_CLIENT_OPTIONS,
        },
      ];
    }

    return plugin;
  });

  if (!foundDevClient) {
    plugins.push(["expo-dev-client", E2E_DEV_CLIENT_OPTIONS]);
  }

  return {
    ...config,
    plugins,
  };
}

module.exports = ({ config }) => {
  const commitId = process.env.EAS_BUILD_GIT_COMMIT_HASH;
  const nrBridgeBaseUrl = process.env.EXPO_PUBLIC_NR_BRIDGE_BASE_URL;

  return withE2EDevClientOptions({
    ...config,
    scheme: "nostroots",
    extra: {
      ...config.extra,
      commitId,
      nrBridgeBaseUrl,
    },
  });
};
