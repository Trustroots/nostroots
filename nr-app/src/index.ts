/* eslint-disable import/first */
import "@/secureRandom.bootstrap";

import "fast-text-encoding";
import "./MessageChannel.js";

import { store } from "@/redux/store";
import { injectStore } from "@/nostr/subscriptions.nostr";
injectStore(store);

if (__DEV__) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./reactotron.config");
}

import "expo-router/entry";
