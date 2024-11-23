import { eventSchema } from "../../nr-common/mod.ts";
import { amqp } from "../deps.ts";
import { getRelayPool } from "./relays.ts";
import { processEventFactoryFactory } from "./validation/repost.ts";

const exchangeName = "nostrEvents";
const queueName = "repost";

export async function consume(privateKey: Uint8Array, isDev: true | undefined) {
  const relayPool = await getRelayPool(isDev);
  const processEventFactory = processEventFactoryFactory(relayPool, privateKey);

  const connection = await amqp.connect(
    "amqp://insecure:insecure@localhost:5672"
  );
  const channel = await connection.openChannel();
  await channel.declareExchange({
    exchange: exchangeName,
    durable: true,
    type: "fanout",
  });
  await channel.declareQueue({
    queue: queueName,
    durable: true,
  });
  await channel.bindQueue({
    exchange: exchangeName,
    queue: queueName,
  });
  channel.consume(
    { queue: queueName },
    async function processQueueItem(args, _props, data) {
      try {
        const text = new TextDecoder().decode(data);
        console.log("#QXP3Bz Got event body", args, text);

        const strfryMessage = JSON.parse(text);
        const { event: unvalidatedEvent } = strfryMessage;

        const event = eventSchema.parse(unvalidatedEvent);

        await processEventFactory(event);

        await channel.ack({ deliveryTag: args.deliveryTag });
      } catch (error) {
        console.error("#Y5y2oB Error in channel.consume", error);
      }
    }
  );
}
