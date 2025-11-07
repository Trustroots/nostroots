/* eslint-disable import/first */
// import "polyfill"
// import { getRandomValues } from "expo-crypto";
import "react-native-get-random-values";

import "fast-text-encoding";
import "./MessageChannel.js";

// Patch `crypto.getRandomValues()` for `nip06` which depends on `@scure/bip32`
// which depends on `@noble/hashes/utils` which depends on
// `@noble/hashes/crypto` which in turn checks for
// `globalThis.crypto.getRandomBytes()` or `globalThis.crypto.getRandomValues()`
// and throws if neither exist.
// globalThis.crypto = {
//   getRandomValues,
// } as any;

import { store } from "@/redux/store";
import { injectStore } from "@/nostr/subscriptions.nostr";
injectStore(store);

if (__DEV__) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./reactotron.config");
}

import "expo-router/entry";
