import {
  NOSTROOTS_VALIDATION_PUBKEY,
  NOTIFICATION_SERVER_PUBKEY,
} from "@trustroots/nr-common";

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
  url: string;
}

export interface PingConfig {
  name: string;
  pubkey: string;
}

export const config = {
  telegramBot: getEnvRequired("TELEGRAM_BOT"),
  telegramChat: getEnvRequired("TELEGRAM_CHAT"),
  checkIntervalMs: parseInt(
    getEnvOptional("CHECK_INTERVAL_MS") ?? "900000",
    10,
  ),
  startupDelayMs: parseInt(getEnvOptional("STARTUP_DELAY_MS") ?? "120000", 10),
  healthCheckTimeoutMs: parseInt(
    getEnvOptional("HEALTH_CHECK_TIMEOUT_MS") ?? "5000",
    10,
  ),

  services: [
    { name: "strfry-relay", url: getEnvRequired("RELAY_URL") },
    { name: "rabbitmq", url: getEnvRequired("RABBITMQ_URL") },
    { name: "nr-relay-to-rabbit", url: getEnvRequired("RELAY_TO_RABBIT_URL") },
  ] as ServiceConfig[],

  // Ping configuration
  relayWsUrl: getEnvRequired("RELAY_WS_URL"),
  pingTimeoutSeconds: parseInt(
    getEnvOptional("PING_TIMEOUT_SECONDS") ?? "60",
    10,
  ),
  pings: [
    { name: "nr-server", pubkey: NOSTROOTS_VALIDATION_PUBKEY },
    { name: "nr-notification-daemon", pubkey: NOTIFICATION_SERVER_PUBKEY },
  ] as PingConfig[],
};
