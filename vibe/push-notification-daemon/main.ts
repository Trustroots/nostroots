import { getPublicKey } from "nostr-tools/pure";
import { hexToBytes } from "@noble/hashes/utils";
import { config } from "./src/config.ts";
import { log } from "./src/log.ts";
import { consumeFromRabbit } from "./src/rabbit.ts";
import { loadSubscriptionsFromRelay } from "./src/relay.ts";
import { SubscriptionStore } from "./src/subscriptionStore.ts";

const publicKey = getPublicKey(hexToBytes(config.privateKey));
log.info(`Derived Vibe push daemon public key: ${publicKey}`);

const store = new SubscriptionStore();

await loadSubscriptionsFromRelay(config.strfryUrl, config.privateKey, publicKey, store);

await consumeFromRabbit({
  amqpUrl: config.amqpUrl,
  queueName: config.rabbitmqQueue,
  privateKey: config.privateKey,
  publicKey,
  relayUrl: config.strfryUrl,
  apns: config.apns,
  store,
});
