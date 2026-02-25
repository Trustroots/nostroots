import * as amqp from "@nashaddams/amqp";
import {
  AMQP_EXCHANGE_NAME,
  AMQP_EXCHANGE_TYPE,
  NOTIFICATION_SUBSCRIPTION_KIND,
} from "@trustroots/nr-common";
import type { NostrEvent } from "nostr-tools";
import type { SubscriptionStore } from "./subscriptionStore.ts";
import {
  decryptAndParseSubscription,
  isEncryptedForDaemon,
} from "./decrypt.ts";
import { matchAndNotify } from "./matching.ts";

interface RabbitMessage {
  readonly type: "new";
  readonly event: NostrEvent;
  readonly receivedAt: number;
  readonly sourceType: string;
  readonly sourceInfo: string;
}

export async function consumeFromRabbit(
  amqpUrl: string,
  queueName: string,
  privateKey: string,
  publicKey: string,
  expoAccessToken: string,
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

  console.log(
    `RabbitMQ setup complete. Consuming from queue: ${queueName} with ${store.totalFilterCount} filters`,
  );

  await channel.consume(
    { queue: queueName },
    async (args, _props, data) => {
      try {
        const text = new TextDecoder().decode(data);
        console.log(`Received message: ${text}`);

        const wrapper: RabbitMessage = JSON.parse(text);
        const event = wrapper.event;

        if (event.kind === NOTIFICATION_SUBSCRIPTION_KIND) {
          console.log(
            `Received new appData message from pubkey: ${event.pubkey}`,
          );

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
          console.log(
            `Parsed Nostr Event: ID=${event.id} Kind=${event.kind} PubKey=${event.pubkey} Source=${wrapper.sourceInfo}`,
          );
          await matchAndNotify(event, store, expoAccessToken);
        }

        await channel.ack({ deliveryTag: args.deliveryTag });
      } catch (error) {
        console.error("Error processing message:", error);
        await channel.nack({ deliveryTag: args.deliveryTag, requeue: true });
      }
    },
  );
}
