export declare const PACKAGE_VERSION = "0.0.1";
export declare const DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH: 2;
export declare const TRUSTROOTS_PROFILE_KIND: 10390;
export declare const NOTIFICATION_SUBSCRIPTION_KIND: 10395;
export declare const MAP_NOTE_KIND: 30397;
export declare const MAP_NOTE_REPOST_KIND: 30398;
export declare const OPEN_LOCATION_CODE_LABEL_NAMESPACE: "open-location-code";
export declare const OPEN_LOCATION_CODE_TAG_NAME: "open-location-code";
export declare const OPEN_LOCATION_CODE_PREFIX_LABEL_NAMESPACE: "open-location-code-prefix";
export declare const OPEN_LOCATION_CODE_PREFIX_TAG_NAME: "open-location-code-prefix";
export declare const TRUSTROOTS_USERNAME_LABEL_NAMESPACE = "org.trustroots:username";
export declare const TRUSTROOTS_PICTURE_LABEL_NAMESPACE = "org.trustroots:picture";
export declare const TRUSTROOTS_USERNAME_MIN_LENGTH = 3;
export declare const CONTENT_MINIMUM_LENGTH = 3;
export declare const CONTENT_MAXIMUM_LENGTH = 300;
export declare const DEFAULT_RELAY_URL = "wss://relay.trustroots.org";
export declare const NOTIFICATION_SERVER_PUBKEY: "51340781544c47086eb049b0ac10403d75554bf7531f5934b75194f70d15f5f5";
export declare const DEV_PUBKEY: "80789235a71a388074abfa5c482e270456d2357425266270f82071cf2b1de74a";
export declare const NOSTROOTS_VALIDATION_PUBKEY: "f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b";
export declare const HITCHMAPS_AUTHOR_PUBLIC_KEY: "53055ee011e96a00a705b38253b9cbc6614ccbd37df4dad42ec69bbe608c4209";
export declare const HITCHWIKI_AUTHOR_PUBLIC_KEY: "16db5234c1dd8082897bd2d21bbec4b8051d2cd03e24b819aa5232077d443da9";
export declare const TIMESAFARI_AUTHOR_PUBLIC_KEY: "76e88d2e653fc3655f8e0b97f6bc85f5468eaffc5d64522b584ce13eedbd8af7";
export declare const SENTRY_DSN: "https://ea370f9e4aba87f6e69a479f2d41bc23@o4508806276841472.ingest.de.sentry.io/4508806292176976";
export type MapLayer = {
    title: string;
    rootUrl: string;
    kind: 30399 | 30398 | 30397;
    pubkey: string;
    markerColor: string;
    rectangleColor: string;
};
export declare const MAP_LAYERS: {
    readonly hitchmap: MapLayer;
    readonly hitchwiki: MapLayer;
    readonly timesafari: MapLayer;
    readonly triphopping: MapLayer;
    readonly unverified: MapLayer;
};
export type MAP_LAYER_KEY = keyof typeof MAP_LAYERS;
export declare const PLUS_CODE_TAG_KEY: "l";
export declare const LABEL_NAMESPACE_TAG: "L";
export declare const DEFAULT_RELAYS: readonly ["wss://relay.trustroots.org"];
export declare const DEV_RELAYS: string[];
