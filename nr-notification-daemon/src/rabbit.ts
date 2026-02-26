import {
  AMQP_EXCHANGE_NAME,
  AMQP_EXCHANGE_TYPE,
  NOTIFICATION_SUBSCRIPTION_KIND,
} from "@trustroots/nr-common";
import { connectWithRetry, type RabbitMessage } from "@trustroots/amqp";
import type { SubscriptionStore } from "./subscriptionStore.ts";
import {
  decryptAndParseSubscription,
  isEncryptedForDaemon,
} from "./decrypt.ts";
import { matchAndNotify } from "./matching.ts";

export async function consumeFromRabbit(
  amqpUrl: string,
  queueName: string,
  privateKey: string,
  publicKey: string,
  expoAccessToken: string,
  relayUrl: string,
  store: SubscriptionStore,
): Promise<void> {
  const connection = await connectWithRetry(amqpUrl);

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
          await matchAndNotify(event, store, expoAccessToken, relayUrl);
        }

        await channel.ack({ deliveryTag: args.deliveryTag });
      } catch (error) {
        console.error("Error processing message:", error);
        await channel.nack({ deliveryTag: args.deliveryTag, requeue: true });
      }
    },
  );
}
