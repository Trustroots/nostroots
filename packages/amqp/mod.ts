import * as amqp from "@nashaddams/amqp";

export { rabbitMessageSchema, type RabbitMessage } from "./message.ts";

const RETRY_DELAY_MS = 5000;
const RETRY_JITTER_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(): number {
  return RETRY_DELAY_MS + Math.floor(Math.random() * RETRY_JITTER_MS);
}

export type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;

export async function connectWithRetry(url: string): Promise<AmqpConnection> {
  const parsedUrl = URL.parse(url);
  if (parsedUrl === null) {
    throw new Error(`#jwBa1l Failed to parse AMQP URL: ${url}`);
  }

  try {
    console.debug(`#Kx7Rm2 Connecting to RabbitMQ...`);
    return await amqp.connect({
      hostname: parsedUrl.hostname,
      port: parseInt(parsedUrl.port),
      username: parsedUrl.username,
      password: parsedUrl.password,
    });
  } catch (error) {
    const delayMs = getRetryDelay();
    console.error(
      `#Np9To4 Connection failed, retrying in ${delayMs}ms...`,
      error,
    );
    await sleep(delayMs);
    return connectWithRetry(url);
  }
}
