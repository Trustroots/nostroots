import { cliffy, nostrTools } from "./deps.ts";
import { log } from "./log.ts";
import { repost } from "./validation/repost.ts";

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
  .action((options) => {
    const { isDev } = options;
    const privateKey = getOrCreatePrivateKey(options.privateKeyNsec);
    const maxAgeMinutes = options.maxAgeMinutes;

    log.debug(`#PnFUPS Startup isDev ${isDev}`);

    repost(privateKey, isDev, maxAgeMinutes);
  })
  .parse(Deno.args);
