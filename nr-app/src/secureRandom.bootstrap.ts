import { getRandomValues } from "expo-crypto";

// nip06 and nostr-tools read the Web Crypto global. Install Expo's native
// implementation before loading them, without a debugger Math.random fallback.
// Keep the existing object for libraries that have already captured its reference.
globalThis.crypto ??= {} as Crypto;
globalThis.crypto.getRandomValues =
  getRandomValues as Crypto["getRandomValues"];
