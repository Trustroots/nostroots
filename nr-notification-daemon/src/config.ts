function getEnv(key: string): string | undefined {
  return Deno.env.get(key);
}

function getEnvString(key: string, fallback?: string): string {
  const val = getEnv(key);
  if (typeof val === "string" && val.length > 0) {
    return val;
  }
  if (typeof fallback === "string" && fallback.length > 0) {
    return fallback;
  }
  throw new Error(`Missing required env var ${key}`);
}

export const config = {
  privateKey: getEnvString("PRIVATEKEY"),
  expoAccessToken: getEnvString("EXPOACCESSTOKEN"),
  strfryUrl: getEnvString("STRFRY_URL", "ws://localhost:7777"),
  amqpUrl: getEnvString("AMQP_URL", "amqp://guest:guest@localhost:5672/"),
  rabbitmqQueue: getEnvString("RABBITMQ_QUEUE", "nostr_events"),
};
