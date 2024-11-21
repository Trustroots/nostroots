export const DEV_PUBKEY =
  "80789235a71a388074abfa5c482e270456d2357425266270f82071cf2b1de74a" as const;

export const HITCHMAPS_AUTHOR_PUBLIC_KEY =
  "53055ee011e96a00a705b38253b9cbc6614ccbd37df4dad42ec69bbe608c4209" as const;

export type MapLayer = {
  title: string;
  rootUrl: string;
  kind: 30399 | 30398;
  pubKey: string;
};

export type MAP_LAYER_KEY = "hitchmap" | "timesafari" | "triphopping";
export const MAP_LAYERS: { [key in MAP_LAYER_KEY]: MapLayer } = {
  hitchmap: {
    title: "Hitchmap",
    rootUrl: "https://www.hitchmap.com",
    kind: 30399,
    pubKey: "abcd",
  },
  timesafari: {
    title: "Time Safari",
    rootUrl: "https://www.timesafari.app",
    kind: 30399,
    pubKey: "abc",
  },
  triphopping: {
    title: "Trip Hopping",
    rootUrl: "https://www.triphopping.com",
    kind: 30398,
    pubKey: "abc",
  },
} as const;
