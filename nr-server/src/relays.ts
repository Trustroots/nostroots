import { newQueue, nostrify } from "../deps.ts";
import { DEFAULT_RELAYS, DEV_RELAYS } from "./common/constants.ts";

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
