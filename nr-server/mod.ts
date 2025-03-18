import { cliffy, nostrTools } from "./deps.ts";
import { consume } from "./src/consume.ts";
import { log } from "./src/log.ts";
import { subscribeAndRepost } from "./src/subscribe.ts";

function getOrCreatePrivateKey(maybePrivateKeyNsec?: string) {
  if (typeof maybePrivateKeyNsec === "string") {
    const decoded = nostrTools.nip19.decode(maybePrivateKeyNsec);
    if (decoded.type !== "nsec") {
      throw new Error("#5jLJ2W Invalid nsec");
    }
    return decoded.data;
  }

  const key = nostrTools.generateSecretKey();
  const nsec = nostrTools.nip19.nsecEncode(key);
  log.info(`#2yrJza Using random nsec ${nsec}`);
  return key;
}

await new cliffy.Command()
  .globalEnv("IS_DEV", "Set to true to run in development mode")
  .globalEnv(
    "PRIVATE_KEY_NSEC=<value:string>",
    "Specify the private key in nsec format"
  )
  .env(
    "MAX_AGE_MINUTES=<value:number>",
    "How many minutes into the past to check for events to validate"
  )
  .env(
    "SUBSCRIBE=<subscribe:boolean>",
    "Subscribe to relays to fetch events instead of using AMQP."
  )
  .env(
    "AMQP_URL=<amqpUrl:string>",
    "The URL to connect to AMQP, like amqp://insecure:insecure@localhost:5672"
  )
  .action((options) => {
    const { isDev } = options;
    const privateKey = getOrCreatePrivateKey(options.privateKeyNsec);
    const maxAgeMinutes = options.maxAgeMinutes;

    log.debug(
      `#PnFUPS Startup isDev ${isDev} and subscribe ${options.subscribe}`
    );

    if (options.subscribe) {
      subscribeAndRepost(privateKey, isDev, maxAgeMinutes);
    } else {
      consume(privateKey, isDev, options.amqpUrl);
    }
  })
  .parse(Deno.args);
