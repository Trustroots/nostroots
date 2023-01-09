import {
  Event,
  getEventHash,
  getPublicKey,
  relayInit,
  signEvent,
} from "nostr-tools";
import { RELAY } from "../../constants";
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

export const getNostrProfile = (publicKey: string) => {
  return promiseWithTimeout(() => {
    return new Promise((resolve, reject) => {
      after.then(() => {
        const sub = relay.sub([
          {
            kinds: [0],
            authors: [publicKey],
          },
        ]);
        sub.on("event", (event: any) => {
          const profile = JSON.parse(event.content);
          resolve(profile);
          console.log("#AjDclA Got event for getProfile subscription", event);
        });
        sub.on("eose", () => {
          console.log("#3sVIaQ Got eose for getProfile subscription");
          sub.unsub();
        });
      });
    });
  }, 3e3);
};

export const setNostrProfile = (
  privateKey: string,
  profile: Required<NostrProfile>
) => {
  return promiseWithTimeout(() => {
    return new Promise<void>((resolve, reject) => {
      after.then(() => {
        const pubkey = getPublicKey(privateKey);
        const event: Event = {
          kind: 0,
          created_at: Math.floor(Date.now() / 1e3),
          tags: [],
          content: globalThis.JSON.stringify(profile),
          pubkey,
        };
        event.id = getEventHash(event);
        event.sig = signEvent(event, privateKey);

        const pub = relay.publish(event);

        console.log("#ahrp6D Publishing event", privateKey, pubkey, event);

        pub.on("ok", () => {
          console.log("#SzkjRB Event published");
          // resolve();
        });

        pub.on("seen", () => {
          console.log("#dSL437 Event published and seen");
          resolve();
        });

        pub.on("failed", (reason: any) => {
          console.error("#MYiGu0 setNostrProfile() failed", reason);
          reject(reason);
        });
      });
    });
  }, 2e3);
};
