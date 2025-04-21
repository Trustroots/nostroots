"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEV_RELAYS = exports.DEFAULT_RELAYS = exports.LABEL_NAMESPACE_TAG = exports.PLUS_CODE_TAG_KEY = exports.MAP_LAYERS = exports.SENTRY_DSN = exports.TIMESAFARI_AUTHOR_PUBLIC_KEY = exports.HITCHWIKI_AUTHOR_PUBLIC_KEY = exports.HITCHMAPS_AUTHOR_PUBLIC_KEY = exports.NOSTROOTS_VALIDATION_PUBKEY = exports.DEV_PUBKEY = exports.NOTIFICATION_SERVER_PUBKEY = exports.DEFAULT_RELAY_URL = exports.CONTENT_MAXIMUM_LENGTH = exports.CONTENT_MINIMUM_LENGTH = exports.TRUSTROOTS_USERNAME_MIN_LENGTH = exports.TRUSTROOTS_PICTURE_LABEL_NAMESPACE = exports.TRUSTROOTS_USERNAME_LABEL_NAMESPACE = exports.OPEN_LOCATION_CODE_PREFIX_TAG_NAME = exports.OPEN_LOCATION_CODE_PREFIX_LABEL_NAMESPACE = exports.OPEN_LOCATION_CODE_TAG_NAME = exports.OPEN_LOCATION_CODE_LABEL_NAMESPACE = exports.MAP_NOTE_REPOST_KIND = exports.MAP_NOTE_KIND = exports.NOTIFICATION_SUBSCRIPTION_KIND = exports.TRUSTROOTS_PROFILE_KIND = exports.DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH = exports.PACKAGE_VERSION = void 0;
exports.PACKAGE_VERSION = "0.0.1";
exports.DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH = 2;
exports.TRUSTROOTS_PROFILE_KIND = 10390;
exports.NOTIFICATION_SUBSCRIPTION_KIND = 10395;
exports.MAP_NOTE_KIND = 30397;
exports.MAP_NOTE_REPOST_KIND = 30398;
exports.OPEN_LOCATION_CODE_LABEL_NAMESPACE = "open-location-code";
exports.OPEN_LOCATION_CODE_TAG_NAME = exports.OPEN_LOCATION_CODE_LABEL_NAMESPACE;
exports.OPEN_LOCATION_CODE_PREFIX_LABEL_NAMESPACE = "open-location-code-prefix";
exports.OPEN_LOCATION_CODE_PREFIX_TAG_NAME = exports.OPEN_LOCATION_CODE_PREFIX_LABEL_NAMESPACE;
exports.TRUSTROOTS_USERNAME_LABEL_NAMESPACE = "org.trustroots:username";
exports.TRUSTROOTS_PICTURE_LABEL_NAMESPACE = "org.trustroots:picture";
exports.TRUSTROOTS_USERNAME_MIN_LENGTH = 3;
exports.CONTENT_MINIMUM_LENGTH = 3;
exports.CONTENT_MAXIMUM_LENGTH = 300;
exports.DEFAULT_RELAY_URL = "wss://relay.trustroots.org";
exports.NOTIFICATION_SERVER_PUBKEY = "51340781544c47086eb049b0ac10403d75554bf7531f5934b75194f70d15f5f5";
exports.DEV_PUBKEY = "80789235a71a388074abfa5c482e270456d2357425266270f82071cf2b1de74a";
exports.NOSTROOTS_VALIDATION_PUBKEY = "f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b";
exports.HITCHMAPS_AUTHOR_PUBLIC_KEY = "53055ee011e96a00a705b38253b9cbc6614ccbd37df4dad42ec69bbe608c4209";
exports.HITCHWIKI_AUTHOR_PUBLIC_KEY = "16db5234c1dd8082897bd2d21bbec4b8051d2cd03e24b819aa5232077d443da9";
exports.TIMESAFARI_AUTHOR_PUBLIC_KEY = "76e88d2e653fc3655f8e0b97f6bc85f5468eaffc5d64522b584ce13eedbd8af7";
// cross-env DSN id - use for native + server
exports.SENTRY_DSN = "https://ea370f9e4aba87f6e69a479f2d41bc23@o4508806276841472.ingest.de.sentry.io/4508806292176976";
const trustroots = {
    title: "Trustroots",
    filter: {
        authors: [exports.NOSTROOTS_VALIDATION_PUBKEY],
        kinds: [exports.MAP_NOTE_REPOST_KIND],
    },
    rootUrl: "",
    kind: 30398,
    pubkey: exports.NOSTROOTS_VALIDATION_PUBKEY,
    markerColor: "green",
    rectangleColor: "grey",
};
const hitchmap = {
    title: "Hitchmap",
    rootUrl: "https://hitchmap.com",
    filter: {
        kinds: [30399],
        authors: [exports.HITCHMAPS_AUTHOR_PUBLIC_KEY],
    },
    kind: 30399,
    pubkey: exports.HITCHMAPS_AUTHOR_PUBLIC_KEY,
    markerColor: "yellow",
    rectangleColor: "rgba(255, 255, 0, 0.5)",
};
const hitchwiki = {
    title: "Hitchwiki",
    rootUrl: "https://hitchwiki.org",
    filter: {
        kinds: [30399],
        authors: [exports.HITCHWIKI_AUTHOR_PUBLIC_KEY],
    },
    kind: 30399,
    pubkey: exports.HITCHWIKI_AUTHOR_PUBLIC_KEY,
    markerColor: "gold",
    rectangleColor: "rgba(255, 215, 0, 0.5)",
};
const timesafari = {
    title: "Time Safari",
    rootUrl: "https://www.timesafari.app",
    filter: {
        kinds: [30399],
        authors: [exports.TIMESAFARI_AUTHOR_PUBLIC_KEY],
    },
    kind: 30399,
    pubkey: exports.TIMESAFARI_AUTHOR_PUBLIC_KEY,
    markerColor: "blue",
    rectangleColor: "rgba(0, 0, 255, 0.5)",
};
const triphopping = {
    title: "Trip Hopping",
    rootUrl: "https://www.triphopping.com",
    filter: {
        kinds: [30398],
        authors: [exports.DEV_PUBKEY],
    },
    kind: 30398,
    pubkey: exports.DEV_PUBKEY,
    markerColor: "brown",
    rectangleColor: "rgba(0, 0, 255, 0.5)",
};
const unverified = {
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
exports.MAP_LAYERS = {
    trustroots,
    hitchmap,
    hitchwiki,
    timesafari,
    triphopping,
    unverified,
};
exports.PLUS_CODE_TAG_KEY = "l";
exports.LABEL_NAMESPACE_TAG = "L";
exports.DEFAULT_RELAYS = [exports.DEFAULT_RELAY_URL];
exports.DEV_RELAYS = ["ws://localhost:7000"];
