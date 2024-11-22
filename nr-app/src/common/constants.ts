export const DEFAULT_RELAY = "wss://relay.trustroots.org";

export const DEV_PUBKEY =
  "80789235a71a388074abfa5c482e270456d2357425266270f82071cf2b1de74a" as const;

export const NOSTROOTS_VALIDATION_PUBKEY =
  "f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b" as const;

export const HITCHMAPS_AUTHOR_PUBLIC_KEY =
  "53055ee011e96a00a705b38253b9cbc6614ccbd37df4dad42ec69bbe608c4209" as const;

export const HITCHWIKI_AUTHOR_PUBLIC_KEY =
  "16db5234c1dd8082897bd2d21bbec4b8051d2cd03e24b819aa5232077d443da9" as const;

export const TIMESAFARI_AUTHOR_PUBLIC_KEY =
  "76e88d2e653fc3655f8e0b97f6bc85f5468eaffc5d64522b584ce13eedbd8af7" as const;

export type MapLayer = {
  title: string;
  rootUrl: string;
  kind: 30399 | 30398;
  pubkey: string;
  markerColor: string;
};

export type MAP_LAYER_KEY = "hitchmap" | "timesafari" | "triphopping";
export const MAP_LAYERS: { [key in MAP_LAYER_KEY]: MapLayer } = {
  hitchmap: {
    title: "Hitchmap",
    rootUrl: "https://www.hitchmap.com",
    kind: 30399,
    pubkey: HITCHMAPS_AUTHOR_PUBLIC_KEY,
    markerColor: "gold",
  },
  hitchwiki: {
    title: "Hitchwiki",
    rootUrl: "https://hitchwiki.org",
    kind: 30399,
    pubkey: HITCHWIKI_AUTHOR_PUBLIC_KEY,
    markerColor: "yellow",
  },
  timesafari: {
    title: "Time Safari",
    rootUrl: "https://www.timesafari.app",
    kind: 30399,
    pubkey: TIMESAFARI_AUTHOR_PUBLIC_KEY,
    markerColor: "green",
  },
  triphopping: {
    title: "Trip Hopping",
    rootUrl: "https://www.triphopping.com",
    kind: 30398,
    pubkey: DEV_PUBKEY,
    markerColor: "blue",
  },
} as const;
