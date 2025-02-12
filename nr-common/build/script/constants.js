"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAP_LAYERS = exports.TIMESAFARI_AUTHOR_PUBLIC_KEY = exports.HITCHWIKI_AUTHOR_PUBLIC_KEY = exports.HITCHMAPS_AUTHOR_PUBLIC_KEY = exports.NOSTROOTS_VALIDATION_PUBKEY = exports.DEV_PUBKEY = exports.DEFAULT_RELAY_URL = exports.OPEN_LOCATION_CODE_PREFIX_TAG_NAME = exports.OPEN_LOCATION_CODE_TAG_NAME = exports.MAP_NOTE_REPOST_KIND = exports.MAP_NOTE_KIND = exports.DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH = void 0;
exports.DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH = 2;
exports.MAP_NOTE_KIND = 30397;
exports.MAP_NOTE_REPOST_KIND = 30398;
exports.OPEN_LOCATION_CODE_TAG_NAME = "open-location-code";
exports.OPEN_LOCATION_CODE_PREFIX_TAG_NAME = "open-location-code-prefix";
exports.DEFAULT_RELAY_URL = "wss://relay.trustroots.org";
exports.DEV_PUBKEY = "80789235a71a388074abfa5c482e270456d2357425266270f82071cf2b1de74a";
exports.NOSTROOTS_VALIDATION_PUBKEY = "f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b";
exports.HITCHMAPS_AUTHOR_PUBLIC_KEY = "53055ee011e96a00a705b38253b9cbc6614ccbd37df4dad42ec69bbe608c4209";
exports.HITCHWIKI_AUTHOR_PUBLIC_KEY = "16db5234c1dd8082897bd2d21bbec4b8051d2cd03e24b819aa5232077d443da9";
exports.TIMESAFARI_AUTHOR_PUBLIC_KEY = "76e88d2e653fc3655f8e0b97f6bc85f5468eaffc5d64522b584ce13eedbd8af7";
const hitchmap = {
    title: "Hitchmap",
    rootUrl: "https://hitchmap.com",
    kind: 30399,
    pubkey: exports.HITCHMAPS_AUTHOR_PUBLIC_KEY,
    markerColor: "yellow",
    rectangleColor: "rgba(255, 255, 0, 0.5)",
};
const hitchwiki = {
    title: "Hitchwiki",
    rootUrl: "https://hitchwiki.org",
    kind: 30399,
    pubkey: exports.HITCHWIKI_AUTHOR_PUBLIC_KEY,
    markerColor: "gold",
    rectangleColor: "rgba(255, 215, 0, 0.5)",
};
const timesafari = {
    title: "Time Safari",
    rootUrl: "https://www.timesafari.app",
    kind: 30399,
    pubkey: exports.TIMESAFARI_AUTHOR_PUBLIC_KEY,
    markerColor: "blue",
    rectangleColor: "rgba(0, 0, 255, 0.5)",
};
const triphopping = {
    title: "Trip Hopping",
    rootUrl: "https://www.triphopping.com",
    kind: 30398,
    pubkey: exports.DEV_PUBKEY,
    markerColor: "brown",
    rectangleColor: "rgba(0, 0, 255, 0.5)",
};
const unverified = {
    title: "Unverified",
    rootUrl: "https://notes.trustroots.org",
    kind: 30397,
    pubkey: "",
    markerColor: "red",
    rectangleColor: "rgba(255, 0, 0, 0.5)",
};
exports.MAP_LAYERS = {
    hitchmap,
    hitchwiki,
    timesafari,
    triphopping,
    unverified,
};
