import { getPublicKey } from "npm:nostr-tools@2.10.4/pure";
import { hexToBytes } from "npm:@noble/hashes@1.7.1/utils";
import { SubscriptionStore } from "./src/subscriptionStore.ts";
import { loadSubscriptionsFromRelay } from "./src/relay.ts";
import { consumeFromRabbit } from "./src/rabbit.ts";

const privateKey = Deno.env.get("PRIVATEKEY");
if (!privateKey) {
  console.error("PRIVATEKEY not found in env. Exiting.");
  Deno.exit(1);
}

const expoAccessToken = Deno.env.get("EXPOACCESSTOKEN");
if (!expoAccessToken) {
  console.error("EXPOACCESSTOKEN not found in env. Exiting.");
  Deno.exit(1);
}

const strfryUrl = Deno.env.get("STRFRY_URL") ?? "ws://localhost:7777";
const amqpUrl = Deno.env.get("AMQP_URL") ?? "amqp://guest:guest@localhost:5672/";
const queueName = Deno.env.get("RABBITMQ_QUEUE") ?? "nostr_events";

const publicKey = getPublicKey(hexToBytes(privateKey));
console.log(`Derived public key: ${publicKey}`);

const store = new SubscriptionStore();

await loadSubscriptionsFromRelay(strfryUrl, privateKey, publicKey, store);

await consumeFromRabbit(
  amqpUrl,
  queueName,
  privateKey,
  publicKey,
  expoAccessToken,
  store,
);
