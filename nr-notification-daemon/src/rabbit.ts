import * as amqp from "@nashaddams/amqp";
import {
  AMQP_EXCHANGE_NAME,
  AMQP_EXCHANGE_TYPE,
  NOTIFICATION_SUBSCRIPTION_KIND,
  PING_ACK_KIND,
} from "@trustroots/nr-common";
import { finalizeEvent } from "nostr-tools/pure";
import { hexToBytes } from "@noble/hashes/utils";
import { Relay } from "nostr-tools/relay";
import type { NostrEvent } from "nostr-tools";
import {
  decryptAndParseSubscription,
  isEncryptedForDaemon,
} from "./decrypt.ts";
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

function isPingForUs(event: NostrEvent, publicKey: string): boolean {
  return (
    event.kind === PING_ACK_KIND &&
    event.content === "ping" &&
    event.tags.some((t) => t[0] === "p" && t[1] === publicKey)
  );
}

async function handlePing(
  event: NostrEvent,
  privateKey: string,
  relayUrl: string,
): Promise<void> {
  const ackEvent = finalizeEvent(
    {
      kind: PING_ACK_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["e", event.id],
        ["p", event.pubkey],
      ],
      content: "ack",
    },
    hexToBytes(privateKey),
  );
  const relay = await Relay.connect(relayUrl);
  try {
    await relay.publish(ackEvent);
    log.info(`#Pg2Bk3 Published ACK for ping ${event.id}`);
  } finally {
    relay.close();
  }
}

export async function consumeFromRabbit(
  amqpUrl: string,
  queueName: string,
  privateKey: string,
  publicKey: string,
  expoAccessToken: string,
  relayUrl: string,
  store: SubscriptionStore,
): Promise<void> {
  const url = URL.parse(amqpUrl);
  if (!url) {
    throw new Error(`Failed to parse AMQP URL: ${amqpUrl}`);
  }

  const connection = await amqp.connect({
    hostname: url.hostname,
    port: parseInt(url.port),
    username: url.username,
    password: url.password,
  });

  const channel = await connection.openChannel();
  await channel.qos({ prefetchCount: 1 });

  await channel.declareExchange({
    exchange: AMQP_EXCHANGE_NAME,
    durable: true,
    type: AMQP_EXCHANGE_TYPE,
  });

  await channel.declareQueue({
    queue: queueName,
    durable: true,
  });

  await channel.bindQueue({
    exchange: AMQP_EXCHANGE_NAME,
    queue: queueName,
  });

  log.info(
    `RabbitMQ setup complete. Consuming from queue: ${queueName} with ${store.totalFilterCount} filters`,
  );

  // NOTE: This returns right away
  await channel.consume(
    { queue: queueName },
    async (args, _props, data) => {
      try {
        const text = new TextDecoder().decode(data);
        log.debug(`Received message: ${text}`);

        const wrapper: RabbitMessage = JSON.parse(text);
        const event = wrapper.event;

        if (isPingForUs(event, publicKey)) {
          await handlePing(event, privateKey, relayUrl);
        } else if (event.kind === NOTIFICATION_SUBSCRIPTION_KIND) {
          log.info(`Received new appData message from pubkey: ${event.pubkey}`);

          if (isEncryptedForDaemon(event, publicKey)) {
            const result = await decryptAndParseSubscription(
              event,
              privateKey,
            );
            if (result) {
              store.updateFilters(event.pubkey, result.filters);
              store.updateTokens(event.pubkey, result.tokens);
            }
          }
        } else {
          log.debug(
            `Parsed Nostr Event: ID=${event.id} Kind=${event.kind} PubKey=${event.pubkey} Source=${wrapper.sourceInfo}`,
          );
          await matchAndNotify(event, store, expoAccessToken, relayUrl);
        }

        await channel.ack({ deliveryTag: args.deliveryTag });
      } catch (error) {
        log.error("Error processing message:", error);
        await channel.nack({ deliveryTag: args.deliveryTag, requeue: true });
      }
    },
  );
}
