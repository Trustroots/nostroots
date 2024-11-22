export const PRIVATE_KEY_STORAGE_KEY = "__nostrPrivateKey" as const;
export const RELAYS_STORAGE_KEY = "__nostrRelays" as const;
export const PLUS_CODE_TAG_KEY = "l" as const;
export const LABEL_NAMESPACE_TAG = "L";
export const OPEN_LOCATION_CODE_NAMESPACE_TAG = "open-location-code";
export const MAP_NOTE_KIND = 397;
export const MAP_NOTE_REPOST_KIND = 30398;
export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.primal.net",
  "wss://nostr.manasiwibi.com",
  "wss://nos.lol",
  "wss://relay.trustroots.org",
];
export const DEV_RELAYS = DEFAULT_RELAYS;
export const PANEL_CONTAINER_ID = "panelID";
export const BADGE_CONTAINER_ID = "badge";
export const CONTENT_MINIMUM_LENGTH = 3;
export const CONTENT_MAXIMUM_LENGTH = 300;
export const EARLIEST_FILTER_SINCE = 1716736622;

export const MINIMUM_TRUSTROOTS_USERNAME_LENGTH = 3;

export const WAIT_FOR_KIND_ZERO_TIMEOUT_SECONDS = 5;

export const DEV_PUBKEY =
  "80789235a71a388074abfa5c482e270456d2357425266270f82071cf2b1de74a" as const;

export const HITCHMAPS_AUTHOR_PUBLIC_KEY =
  "53055ee011e96a00a705b38253b9cbc6614ccbd37df4dad42ec69bbe608c4209" as const;

export const DELAY_AFTER_PROCESSING_EVENT_MS = 10;

export const SUBSCRIPTIONS_MAX_AGE_IN_MINUTES = 60;
