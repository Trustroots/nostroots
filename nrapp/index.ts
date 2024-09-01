/* eslint-disable import/first */
// import "polyfill"
import { getRandomValues } from "expo-crypto";

// Patch `crypto.getRandomValues()` for `nip06` which depends on `@scure/bip32`
// which depends on `@noble/hashes/utils` which depends on
// `@noble/hashes/crypto` which in turn checks for
// `globalThis.crypto.getRandomBytes()` or `globalThis.crypto.getRandomValues()`
// and throws if neither exist.
globalThis.crypto = {
  getRandomValues,
} as any;

import "expo-router/entry";
