import { newQueue, nostrify, nrCommon } from "../deps.ts";
const { DEV_PUBKEY } = nrCommon;
import { SUBSCRIPTIONS_MAX_AGE_IN_MINUTES } from "./common/constants.ts";
const { MAP_NOTE_KIND } = nrCommon;
import { log } from "./log.ts";
import { getRelayPool } from "./relays.ts";
import { processEventFactoryFactory } from "./validation/repost.ts";

/**
 * Create the filters to listen for events that we want to repost
 */
function createFilter(
  isDev: true | undefined,
  maxAgeMinutes: number | undefined
): nostrify.NostrFilter[] {
  const maxAgeSeconds =
    typeof maxAgeMinutes === "undefined" ? 60 * 60 : maxAgeMinutes * 60;

  const baseFilter: nostrify.NostrFilter = {
    kinds: [MAP_NOTE_KIND],
    since: Math.floor(Date.now() / 1e3) - maxAgeSeconds,
  };

  if (isDev) {
    return [{ ...baseFilter, authors: [DEV_PUBKEY] }];
  }

  return [baseFilter];
}

export async function subscribeAndRepost(
  privateKey: Uint8Array,
  isDev: true | undefined,
  maxAgeMinutes: number | undefined
) {
  log.debug(`#BmseJH Startup`);

  const relayPool = await getRelayPool(isDev);

  let lastReceivedMessageTimestamp = 0;
  let controller: AbortController;
  let signal: AbortSignal;

  async function _subscribe() {
    console.log(
      `#okwpth (Re)starting subscriptions, last message received at ${lastReceivedMessageTimestamp} (${new Date(
        lastReceivedMessageTimestamp * 1000
      ).toLocaleString()})`
    );
    if (lastReceivedMessageTimestamp)
      maxAgeMinutes =
        (Math.floor(Date.now() / 1000) - lastReceivedMessageTimestamp) / 60 + 1;

    const filter = createFilter(isDev, maxAgeMinutes);

    if (controller) controller.abort();
    controller = new AbortController();
    signal = controller.signal;
    const subscription = relayPool.req(filter, { signal });

    const queue = newQueue(3);
    const processEventFactory = processEventFactoryFactory(
      relayPool,
      privateKey
    );

    try {
      for await (const msg of subscription) {
        console.log("#uFKk4A Got msg", msg);

        if (msg[0] === "EVENT") {
          const event = msg[2];
          lastReceivedMessageTimestamp = event.created_at;
          queue.add(async () => await processEventFactory(event));
        } else if (msg[0] === "EOSE") {
          if (isDev) {
            globalThis.setTimeout(() => {
              controller.abort();
            }, 10e3);
          }
        }
      }
    } catch (e) {
      console.log("#YPKaR3 got error", typeof e, e);
    }
  }

  _subscribe();
  setInterval(_subscribe, SUBSCRIPTIONS_MAX_AGE_IN_MINUTES * 60 * 1000);
}
