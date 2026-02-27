import { getPublicKey } from "nostr-tools/pure";
import { hexToBytes } from "@noble/hashes/utils";
import { config } from "./src/config.ts";
import { log } from "./src/log.ts";
import { consumeFromRabbit } from "./src/rabbit.ts";
import { loadSubscriptionsFromRelay } from "./src/relay.ts";
import { SubscriptionStore } from "./src/subscriptionStore.ts";
import { serializeArg } from "@trustroots/nr-common";

const healthCheckServer = Deno.serve(
  {
    port: 80,
    hostname: "0.0.0.0",
  },
  () =>
    new Response(
      JSON.stringify({ status: "ok", service: "nr-notification-daemon" }),
      { headers: { "content-type": "application/json" } },
    ),
);

const publicKey = getPublicKey(hexToBytes(config.privateKey));
log.info(`Derived public key: ${publicKey}`);

const store = new SubscriptionStore();

try {
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
} catch (error) {
  console.error(`#HqVOjF Fatal error, shutting down ${serializeArg(error)}`);
} finally {
  healthCheckServer.shutdown();
}
