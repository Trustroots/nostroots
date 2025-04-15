import { NOTIFICATION_SUBSCRIPTION_KIND } from "../constants.ts";
import { z } from "../deps.ts";
import { baseEventSchema } from "./base.schema.ts";
import { filterSchema } from "./filter.schema.ts";

/**
 * A kind 10395 event is an event where the user specifies what nostr events
 * they want to receive a push notification about. They do that by specifying a
 * set of nostr filters, and by providing their apple / google push token. This
 * takes the form of a NIP04 encrypted event which is encrypted for the
 * notification server's private key.
 */

export const expoPushTokenListSchema = z.object({
  expoPushToken: z.string(),
}).array();

export const kind10395SubscriptionFilterSchema = z.object({
  filter: filterSchema,
}).array();

export const kind10395ContentDecryptedDecodedSchema = z.object({
  tokens: expoPushTokenListSchema,
  filters: kind10395SubscriptionFilterSchema,
});

export const kind10395EventSchema = baseEventSchema.extend({
  kind: z.literal(NOTIFICATION_SUBSCRIPTION_KIND),
  // TODO Enable version check
  content: z.string(),
});
