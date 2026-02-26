import { getPublicKey } from "nostr-tools/pure";
import { hexToBytes } from "@noble/hashes/utils";
import { config } from "./src/config.ts";
import { log } from "./src/log.ts";
import { consumeFromRabbit } from "./src/rabbit.ts";
import { loadSubscriptionsFromRelay } from "./src/relay.ts";
import { SubscriptionStore } from "./src/subscriptionStore.ts";

const HEALTH_PORT = 80;
Deno.serve(
  { port: HEALTH_PORT },
  () =>
    new Response(
      JSON.stringify({ status: "ok", service: "nr-notification-daemon" }),
      { headers: { "content-type": "application/json" } },
    ),
);

const publicKey = getPublicKey(hexToBytes(config.privateKey));
log.info(`Derived public key: ${publicKey}`);

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
