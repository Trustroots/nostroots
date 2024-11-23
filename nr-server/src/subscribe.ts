import { MAP_NOTE_KIND } from "../../nr-common/constants.ts";
import { newQueue, nostrify } from "../deps.ts";
import {
  DEFAULT_RELAYS,
  DEV_PUBKEY,
  DEV_RELAYS,
  SUBSCRIPTIONS_MAX_AGE_IN_MINUTES,
} from "./common/constants.ts";
import { log } from "./log.ts";
import { processEventFactoryFactory } from "./validation/repost.ts";
const { NPool, NRelay1, NSecSigner } = nostrify;

export async function getRelayPool(isDev: true | undefined) {
  // NOTE: We set `DEFAULT_RELAYS` as ready only which causes type problems
  // later, so here we cast it back to `string[]`
  const relays = isDev ? DEV_RELAYS : (DEFAULT_RELAYS as unknown as string[]);

  // should be chosen according to outbox model
  // https://nostrify.dev/relay/outbox
  const pool = new NPool({
    open(url) {
      return new NRelay1(url);
    },
    async reqRouter(filter: nostrify.NostrFilter[]) {
      const map = new Map();
      relays.map((relay) => {
        map.set(relay, filter);
      });
      return map;
    },
    async eventRouter(_event) {
      return relays;
    },
  });

  return pool;
}

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
      `(Re)starting subscriptions, last message received at ${lastReceivedMessageTimestamp} (${new Date(
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
        console.log("got msg", msg);

        if (msg[0] === "EVENT") {
          const event = msg[2];
          lastReceivedMessageTimestamp = event.created_at;
          queue.add(processEventFactory(event));
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
