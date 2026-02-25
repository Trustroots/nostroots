import { getPublicKey } from "nostr-tools/pure";
import { hexToBytes } from "@noble/hashes/utils";
import { SubscriptionStore } from "./src/subscriptionStore.ts";
import { loadSubscriptionsFromRelay } from "./src/relay.ts";
import { consumeFromRabbit } from "./src/rabbit.ts";
import { config } from "./src/config.ts";

const HEALTH_PORT = 8081;
Deno.serve({ port: HEALTH_PORT }, () =>
  new Response(JSON.stringify({ status: "ok", service: "nr-notification-daemon" }),
    { headers: { "content-type": "application/json" } })
);

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
