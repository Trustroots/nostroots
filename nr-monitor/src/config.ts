function getEnv(key: string): string | undefined {
  return Deno.env.get(key);
}

function getEnvRequired(key: string): string {
  const val = getEnv(key);
  if (typeof val === "string" && val.length > 0) {
    return val;
  }
  throw new Error(`Missing required env var ${key}`);
}

function getEnvOptional(key: string): string | undefined {
  const val = getEnv(key);
  if (typeof val === "string" && val.length > 0) {
    return val;
  }
  return undefined;
}

export interface ServiceConfig {
  name: string;
  displayName: string;
  url: string;
}

export const config = {
  telegramBot: getEnvRequired("TELEGRAM_BOT"),
  telegramChat: getEnvRequired("TELEGRAM_CHAT"),
  checkIntervalMs: parseInt(getEnvOptional("CHECK_INTERVAL_MS") ?? "60000", 10),
  startupDelayMs: parseInt(getEnvOptional("STARTUP_DELAY_MS") ?? "120000", 10),
  healthCheckTimeoutMs: parseInt(
    getEnvOptional("HEALTH_CHECK_TIMEOUT_MS") ?? "5000",
    10,
  ),

  services: [
    {
      name: "strfry-relay",
      displayName: "Relay",
      url: getEnvRequired("RELAY_URL"),
    },
    {
      name: "rabbitmq",
      displayName: "RabbitMQ",
      url: getEnvRequired("RABBITMQ_URL"),
    },
    {
      name: "nr-relay-to-rabbit",
      displayName: "Relay to RabbitMQ",
      url: getEnvRequired("RELAY_TO_RABBIT_URL"),
    },
    {
      name: "nr-server",
      displayName: "Validations",
      url: getEnvRequired("SERVER_URL"),
    },
    {
      name: "nr-notification-daemon",
      displayName: "Notifications",
      url: getEnvRequired("NOTIFICATION_DAEMON_URL"),
    },
  ] as ServiceConfig[],

  // E2E test configuration
  e2eTestPrivateKeyHex: getEnvRequired("E2E_TEST_PRIVATE_KEY_HEX"),
  relayWsUrl: getEnvRequired("RELAY_WS_URL"),
  e2eTimeoutSeconds: parseInt(getEnvOptional("E2E_TIMEOUT_SECONDS") ?? "60", 10),
};
