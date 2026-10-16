import { getPublicKey } from "nostr-tools/pure";
import { hexToBytes } from "@noble/hashes/utils";
import { config } from "./src/config.ts";
import { startHealthServer } from "./src/health.ts";
import { log } from "./src/log.ts";
import { consumeFromRabbit } from "./src/rabbit.ts";
import { loadSubscriptionsFromRelay } from "./src/relay.ts";
import { startPushSubscriptionMetricsPublisher } from "./src/metrics.ts";
import { SubscriptionStore } from "./src/subscriptionStore.ts";

const publicKey = getPublicKey(hexToBytes(config.privateKey));
log.info(`Derived public key: ${publicKey}`);

let ready = false;
startHealthServer(
  { port: config.healthPort, hostname: "0.0.0.0" },
  () => ready,
);

const store = new SubscriptionStore();

await loadSubscriptionsFromRelay(
  config.strfryUrl,
  config.privateKey,
  publicKey,
  store,
);

await startPushSubscriptionMetricsPublisher(
  config.strfryUrl,
  config.privateKey,
  store,
);

await consumeFromRabbit(
  config.amqpUrl,
  config.rabbitmqQueue,
  config.privateKey,
  publicKey,
  config.expoAccessToken,
  config.strfryUrl,
  store,
);

ready = true;
log.info("#hQ7m2c Daemon ready");
