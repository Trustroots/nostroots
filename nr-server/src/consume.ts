import { amqp, nanoid, nrCommon } from "../deps.ts";
const { eventSchema } = nrCommon;
import { getRelayPool } from "./relays.ts";
import { processEventFactoryFactory } from "./validation/repost.ts";
import { log } from "./log.ts";

const exchangeName = "nostrEvents";
const queueName = "repost";

const EMPTY_AMQP_URL = "amqp://insecure:insecure@localhost:5672";

const createId = nanoid.customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
);

export async function consume(
  privateKey: Uint8Array,
  isDev: true | undefined,
  amqpUrl?: string
) {
  const relayPool = await getRelayPool(isDev);
  const processEventFactory = processEventFactoryFactory(relayPool, privateKey);

  const amqpUrlActual =
    typeof amqpUrl === "string" && amqpUrl.length > 0
      ? amqpUrl
      : EMPTY_AMQP_URL;

  if (amqpUrlActual === EMPTY_AMQP_URL) {
    log.debug(`#nxcSXE Using the empty AMQP url`);
  }

  const url = URL.parse(amqpUrlActual);

  if (url === null) {
    throw new Error("#jwBa1l-failed-to-parse-amqp-url");
  }

  try {
    const connection = await amqp.connect({
      hostname: url.hostname,
      port: parseInt(url.port),
      username: url.username,
      password: url.password,
    });
    const channel = await connection.openChannel();

    // Fetch only 1 message at a time
    await channel.qos({ prefetchCount: 1 });

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
        const id = createId();
        try {
          const ack = async () => {
            console.log(`#zQ5dXu ${id} sending ack`);
            await channel.ack({ deliveryTag: args.deliveryTag });
          };

          const text = new TextDecoder().decode(data);
          console.log(`#QXP3Bz Got event body for ${id}`, args, text);

          const strfryMessage = JSON.parse(text);
          const { event: unvalidatedEvent } = strfryMessage;

          // If this throws, then the `channel.ack()` below won't happen
          const { success, data: event } =
            eventSchema.safeParse(unvalidatedEvent);

          if (!success) {
            await ack();
            return;
          }

          await processEventFactory(event, id);

          await ack();
        } catch (error) {
          console.error(`#Y5y2oB Error in channel.consume ${id}`, error);
        }
      }
    );
  } catch (error) {
    log.error(`#s9QMqm consume() failed with error`, error);
  }
}
