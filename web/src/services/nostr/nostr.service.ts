import {
  Event,
  Filter,
  getEventHash,
  getPublicKey,
  relayInit,
  signEvent,
} from "nostr-tools";
import { OFFER_D, OFFER_KIND, RELAY } from "../../constants";
import { promiseWithTimeout } from "../promises/promises.service";

const relay = relayInit(RELAY);

const initNostr = async () => {
  relay.on("connect", () => {
    console.log(`#fm5jwI Connected to relay ${relay.url}`);
  });

  relay.on("error", () => {
    console.log("#6PUlxk Error from relay");
  });

  await relay.connect();
};

const after = initNostr();

export type NostrProfile = {
  name?: string;
  about?: string;
  picture?: string;
};

const getEvents = (filter: Filter): Promise<Event[]> => {
  return promiseWithTimeout(() => {
    return new Promise((resolve, reject) => {
      let results: Event[] = [];
      after.then(() => {
        const sub = relay.sub([filter]);
        sub.on("event", (event: any) => {
          results.push(event);
          console.log("#AjDclA Got event for subscription", filter, event);
        });
        sub.on("eose", () => {
          console.log("#3sVIaQ Got eose for subscription", filter);
          resolve(results);
          sub.unsub();
        });
      });
    });
  }, 3e3);
};

export const getNostrProfile = (publicKey: string) => {
  return getEvents({
    kinds: [0],
    authors: [publicKey],
  }).then((events) => {
    if (events.length === 0) {
      return undefined;
    }
    const [event] = events;
    const profile = globalThis.JSON.parse(event.content);
    return profile;
  });
};

export const getOffers = () => {
  return getEvents({
    kinds: [OFFER_KIND],
    "#d": [OFFER_D],
  }).then((events) => {
    const offers = events.map((event) => {
      const content = globalThis.JSON.parse(event.content);
      const [, location] = event.tags.find((tag) => tag[0] === "l") || [];
      return { ...content, location };
    });
    return offers;
  });
};

const publishEvent = (privateKey: string, event: Event) => {
  return promiseWithTimeout(() => {
    return new Promise<void>((resolve, reject) => {
      after.then(() => {
        event.id = getEventHash(event);
        event.sig = signEvent(event, privateKey);

        const pub = relay.publish(event);

        console.log("#ahrp6D Publishing event", event);

        pub.on("ok", () => {
          console.log("#SzkjRB Event published");
          // resolve();
        });

        pub.on("seen", () => {
          console.log("#dSL437 Event published and seen");
          resolve();
        });

        pub.on("failed", (reason: any) => {
          console.error("#MYiGu0 publishing event failed", reason);
          reject(reason);
        });
      });
    });
  }, 2e3);
};

export const setNostrProfile = (
  privateKey: string,
  profile: Required<NostrProfile>
) => {
  const pubkey = getPublicKey(privateKey);
  const event: Event = {
    kind: 0,
    created_at: Math.floor(Date.now() / 1e3),
    tags: [],
    content: globalThis.JSON.stringify(profile),
    pubkey,
  };
  return publishEvent(privateKey, event);
};

export type Offer = Required<NostrProfile> & {
  location: string;
};
export const publishOffer = (privateKey: string, offer: Offer) => {
  const pubkey = getPublicKey(privateKey);
  const { location, ...content } = offer;
  const event: Event = {
    kind: OFFER_KIND,
    created_at: Math.floor(Date.now() / 1e3),
    tags: [
      ["d", OFFER_D],
      ["l", location],
    ],
    content: globalThis.JSON.stringify(content),
    pubkey,
  };
  return publishEvent(privateKey, event);
};
