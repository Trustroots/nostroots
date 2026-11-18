import { cliffy, nostrTools } from "./deps.ts";
import { consume } from "./src/consume.ts";
import { log } from "./src/log.ts";
import { subscribeAndRepost } from "./src/subscribe.ts";
import { resolvePrivateKey } from "./src/private-key.ts";

await new cliffy.Command()
  .globalEnv("IS_DEV", "Set to true to run in development mode")
  .globalEnv(
    "PRIVATE_KEY_NSEC=<value:string>",
    "Specify the private key in nsec format",
  )
  .env(
    "MAX_AGE_MINUTES=<value:number>",
    "How many minutes into the past to check for events to validate",
  )
  .env(
    "SUBSCRIBE=<subscribe:boolean>",
    "Subscribe to relays to fetch events instead of using AMQP.",
  )
  .env(
    "AMQP_URL=<amqpUrl:string>",
    "The URL to connect to AMQP, like amqp://insecure:insecure@localhost:5672",
  )
  .action(async (options) => {
    const { isDev } = options;
    const { key: privateKey, generatedForDevelopment } = resolvePrivateKey(
      options.privateKeyNsec,
      isDev === true,
    );
    if (generatedForDevelopment) {
      log.info(
        `#2yrJza Using ephemeral development pubkey ${
          nostrTools.getPublicKey(privateKey)
        }`,
      );
    }
    const maxAgeMinutes = options.maxAgeMinutes;

    log.debug(
      `#PnFUPS Startup isDev ${isDev} and subscribe ${options.subscribe}`,
    );

    if (options.subscribe) {
      await subscribeAndRepost(privateKey, isDev, maxAgeMinutes);
    } else {
      await consume(privateKey, isDev, options.amqpUrl);
    }
  })
  .parse(Deno.args);
