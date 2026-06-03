import * as amqp from "@nashaddams/amqp";
import { finalizeEvent } from "nostr-tools/pure";
import { hexToBytes } from "@noble/hashes/utils";
import { Relay } from "nostr-tools/relay";
import type { NostrEvent } from "nostr-tools";
import {
  AMQP_EXCHANGE_NAME,
  AMQP_EXCHANGE_TYPE,
  PING_ACK_KIND,
  VIBE_NOTIFICATION_SUBSCRIPTION_KIND,
} from "./constants.ts";
import type { APNSConfig } from "./config.ts";
import { decryptAndParseSubscription, isEncryptedForDaemon } from "./decrypt.ts";
import { log } from "./log.ts";
import { matchAndNotify } from "./matching.ts";
import type { SubscriptionStore } from "./subscriptionStore.ts";

interface RabbitMessage {
  readonly type: "new";
  readonly event: NostrEvent;
  readonly receivedAt: number;
  readonly sourceType: string;
  readonly sourceInfo: string;
}

interface ConsumeOptions {
  readonly amqpUrl: string;
  readonly queueName: string;
  readonly privateKey: string;
  readonly publicKey: string;
  readonly relayUrl: string;
  readonly apns: APNSConfig;
  readonly store: SubscriptionStore;
}

function isPingForUs(event: NostrEvent, publicKey: string): boolean {
  return event.kind === PING_ACK_KIND &&
    event.content === "ping" &&
    event.tags.some((t) => t[0] === "p" && t[1] === publicKey);
}

async function handlePing(event: NostrEvent, privateKey: string, relayUrl: string): Promise<void> {
  const ackEvent = finalizeEvent({
    kind: PING_ACK_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["e", event.id], ["p", event.pubkey]],
    content: "ack",
  }, hexToBytes(privateKey));
  const relay = await Relay.connect(relayUrl);
  try {
    await relay.publish(ackEvent);
  } finally {
    relay.close();
  }
}

export async function consumeFromRabbit(options: ConsumeOptions): Promise<void> {
  const url = URL.parse(options.amqpUrl);
  if (!url) throw new Error(`Failed to parse AMQP URL: ${options.amqpUrl}`);

  const connection = await amqp.connect({
    hostname: url.hostname,
    port: parseInt(url.port),
    username: url.username,
    password: url.password,
  });

  const channel = await connection.openChannel();
  await channel.qos({ prefetchCount: 1 });
  await channel.declareExchange({ exchange: AMQP_EXCHANGE_NAME, durable: true, type: AMQP_EXCHANGE_TYPE });
  await channel.declareQueue({ queue: options.queueName, durable: true });
  await channel.bindQueue({ exchange: AMQP_EXCHANGE_NAME, queue: options.queueName });

  log.info(`Vibe push daemon consuming ${options.queueName} with ${options.store.totalFilterCount} filters`);

  await channel.consume({ queue: options.queueName }, async (args, _props, data) => {
    try {
      const wrapper: RabbitMessage = JSON.parse(new TextDecoder().decode(data));
      const event = wrapper.event;
      if (isPingForUs(event, options.publicKey)) {
        await handlePing(event, options.privateKey, options.relayUrl);
      } else if (event.kind === VIBE_NOTIFICATION_SUBSCRIPTION_KIND) {
        if (isEncryptedForDaemon(event, options.publicKey)) {
          const payload = await decryptAndParseSubscription(event, options.privateKey);
          if (payload) options.store.update(event.pubkey, payload.filters.map((f) => f.filter), payload.tokens);
        }
      } else {
        await matchAndNotify(event, options.store, options.apns);
      }
      await channel.ack({ deliveryTag: args.deliveryTag });
    } catch (error) {
      log.error("Error processing Vibe push Rabbit message:", error);
      await channel.nack({ deliveryTag: args.deliveryTag, requeue: true });
    }
  });
}
