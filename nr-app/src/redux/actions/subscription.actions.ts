import { createAction } from "@reduxjs/toolkit";
import { Filter } from "nostr-tools";

export const startSubscription = createAction<{
  filter: Filter;
  id?: string;
  relayUrls?: string[];
}>("subscriptions/startSubscription");

export const stopSubscription = createAction<string>(
  "subscriptions/stopSubscription",
);
