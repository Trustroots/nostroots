import { Filter } from "npm:nostr-tools@2.10.4";

export const PACKAGE_VERSION = "0.0.1";

export const DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH = 2 as const;

export const TRUSTROOTS_PROFILE_KIND = 10390 as const;
export const NOTIFICATION_SUBSCRIPTION_KIND = 10395 as const;
export const MAP_NOTE_KIND = 30397 as const;
export const MAP_NOTE_REPOST_KIND = 30398 as const;

export const OPEN_LOCATION_CODE_LABEL_NAMESPACE = "open-location-code" as const;
export const OPEN_LOCATION_CODE_TAG_NAME = OPEN_LOCATION_CODE_LABEL_NAMESPACE;
export const OPEN_LOCATION_CODE_PREFIX_LABEL_NAMESPACE =
  "open-location-code-prefix" as const;
export const OPEN_LOCATION_CODE_PREFIX_TAG_NAME =
  OPEN_LOCATION_CODE_PREFIX_LABEL_NAMESPACE;

export const TRUSTROOTS_USERNAME_LABEL_NAMESPACE = "org.trustroots:username";
export const TRUSTROOTS_PICTURE_LABEL_NAMESPACE = "org.trustroots:picture";
export const TRUSTROOTS_USERNAME_MIN_LENGTH = 3;

export const CONTENT_MINIMUM_LENGTH = 3;
export const CONTENT_MAXIMUM_LENGTH = 300;

export const DEFAULT_RELAY_URL = "wss://relay.trustroots.org";

export const NOTIFICATION_SERVER_PUBKEY =
  "51340781544c47086eb049b0ac10403d75554bf7531f5934b75194f70d15f5f5" as const;

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

// cross-env DSN id - use for native + server
export const SENTRY_DSN =
  "https://ea370f9e4aba87f6e69a479f2d41bc23@o4508806276841472.ingest.de.sentry.io/4508806292176976" as const;

export type MapLayer = {
  title: string;
  filter: Filter;
  // TODO - Figure out how to handle this for trustroots
  rootUrl: string;
  // TODO - Replace kind & pubkey with a filter
  kind: 30399 | 30398 | 30397;
  pubkey: string;
  // TODO - Drop marker colour and rectangle colour
  markerColor: string;
  rectangleColor: string;
};

const trustroots: MapLayer = {
  title: "Trustroots",
  filter: {
    authors: [NOSTROOTS_VALIDATION_PUBKEY],
    kinds: [MAP_NOTE_REPOST_KIND],
  },
  rootUrl: "",
  kind: 30398,
  pubkey: NOSTROOTS_VALIDATION_PUBKEY,
  markerColor: "green",
  rectangleColor: "grey",
};

const hitchmap: MapLayer = {
  title: "Hitchmap",
  rootUrl: "https://hitchmap.com",
  filter: {
    kinds: [30399],
    authors: [HITCHMAPS_AUTHOR_PUBLIC_KEY],
  },
  kind: 30399,
  pubkey: HITCHMAPS_AUTHOR_PUBLIC_KEY,
  markerColor: "yellow",
  rectangleColor: "rgba(255, 255, 0, 0.5)",
};
const hitchwiki: MapLayer = {
  title: "Hitchwiki",
  rootUrl: "https://hitchwiki.org",
  filter: {
    kinds: [30399],
    authors: [HITCHWIKI_AUTHOR_PUBLIC_KEY],
  },
  kind: 30399,
  pubkey: HITCHWIKI_AUTHOR_PUBLIC_KEY,
  markerColor: "gold",
  rectangleColor: "rgba(255, 215, 0, 0.5)",
};
const timesafari: MapLayer = {
  title: "Time Safari",
  rootUrl: "https://www.timesafari.app",
  filter: {
    kinds: [30399],
    authors: [TIMESAFARI_AUTHOR_PUBLIC_KEY],
  },
  kind: 30399,
  pubkey: TIMESAFARI_AUTHOR_PUBLIC_KEY,
  markerColor: "blue",
  rectangleColor: "rgba(0, 0, 255, 0.5)",
};
const triphopping: MapLayer = {
  title: "Trip Hopping",
  rootUrl: "https://www.triphopping.com",
  filter: {
    kinds: [30398],
    authors: [DEV_PUBKEY],
  },
  kind: 30398,
  pubkey: DEV_PUBKEY,
  markerColor: "brown",
  rectangleColor: "rgba(0, 0, 255, 0.5)",
};
const unverified: MapLayer = {
  title: "Unverified",
  rootUrl: "https://notes.trustroots.org",
  filter: {
    kinds: [30397],
  },
  kind: 30397,
  pubkey: "",
  markerColor: "red",
  rectangleColor: "rgba(255, 0, 0, 0.5)",
};

export const MAP_LAYERS = {
  trustroots,
  hitchmap,
  hitchwiki,
  timesafari,
  triphopping,
  unverified,
} as const;
export type MAP_LAYER_KEY = keyof typeof MAP_LAYERS;

export const PLUS_CODE_TAG_KEY = "l" as const;
export const LABEL_NAMESPACE_TAG = "L" as const;
export const DEFAULT_RELAYS = [DEFAULT_RELAY_URL] as const;
export const DEV_RELAYS = ["ws://localhost:7000"];
