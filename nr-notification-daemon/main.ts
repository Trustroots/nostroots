import { getPublicKey } from "nostr-tools/pure";
import { hexToBytes } from "@noble/hashes/utils";
import { SubscriptionStore } from "./src/subscriptionStore.ts";
import { loadSubscriptionsFromRelay } from "./src/relay.ts";
import { consumeFromRabbit } from "./src/rabbit.ts";
import { config } from "./src/config.ts";

const publicKey = getPublicKey(hexToBytes(config.privateKey));
console.log(`Derived public key: ${publicKey}`);

const store = new SubscriptionStore();

await loadSubscriptionsFromRelay(
  config.strfryUrl,
  config.privateKey,
  publicKey,
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
