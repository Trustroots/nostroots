import { getRandomValues } from "expo-crypto";
import { installSecureRandom } from "./secureRandom";

// Install Expo Crypto before key modules load so generation uses the native OS
// CSPRNG and fails closed if it is unavailable. Do not use the React Native
// shim here: it deliberately falls back to `Math.random()` while debugging.
installSecureRandom(getRandomValues as Crypto["getRandomValues"]);
