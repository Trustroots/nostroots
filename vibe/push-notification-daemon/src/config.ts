function getEnv(key: string): string | undefined {
  return Deno.env.get(key);
}

function getEnvString(key: string, fallback?: string): string {
  const val = getEnv(key);
  if (typeof val === "string" && val.length > 0) return val;
  if (typeof fallback === "string" && fallback.length > 0) return fallback;
  throw new Error(`Missing required env var ${key}`);
}

export type APNSEnvironment = "sandbox" | "production";

export interface APNSConfig {
  readonly teamId: string;
  readonly keyId: string;
  readonly privateKey: string;
  readonly topic: string;
  readonly environment: APNSEnvironment;
}

function getAPNSEnvironment(): APNSEnvironment {
  const raw = getEnvString("APNS_ENV", "sandbox").toLowerCase();
  if (raw === "sandbox" || raw === "production") return raw;
  throw new Error("APNS_ENV must be sandbox or production");
}

export const config = {
  privateKey: getEnvString("PRIVATEKEY"),
  strfryUrl: getEnvString("STRFRY_URL"),
  amqpUrl: getEnvString("AMQP_URL"),
  rabbitmqQueue: getEnvString("RABBITMQ_QUEUE", "vibe-push-notification-daemon"),
  apns: {
    teamId: getEnvString("APNS_TEAM_ID"),
    keyId: getEnvString("APNS_KEY_ID"),
    privateKey: getEnvString("APNS_PRIVATE_KEY"),
    topic: getEnvString("APNS_TOPIC", "org.trustroots.nostroots.browser"),
    environment: getAPNSEnvironment(),
  } satisfies APNSConfig,
};
