import { NOTIFICATION_SERVER_PUBKEY, NOTIFICATION_SUBSCRIPTION_KIND, } from "../constants.js";
import { z } from "../deps.js";
import { baseEventTemplateSchema, finalizedEventFields, } from "./base.schema.js";
import { filterSchema } from "./filter.schema.js";
import { getCurrentTimestamp } from "./utils.js";
/**
 * A kind 10395 event is an event where the user specifies what nostr events
 * they want to receive a push notification about. They do that by specifying a
 * set of nostr filters, and by providing their apple / google push token. This
 * takes the form of a NIP04 encrypted event which is encrypted for the
 * notification server's private key.
 */
export const expoPushTokenListSchema = z
    .object({
    expoPushToken: z.string(),
})
    .array();
export const kind10395SubscriptionFilterSchema = z
    .object({
    filter: filterSchema,
})
    .array();
export const kind10395ContentDecryptedDecodedSchema = z.object({
    tokens: expoPushTokenListSchema,
    filters: kind10395SubscriptionFilterSchema,
});
export const kind10395EventTemplateSchema = baseEventTemplateSchema.extend({
    kind: z.literal(NOTIFICATION_SUBSCRIPTION_KIND),
    // TODO Enable version check
    content: z.string(),
});
export const kind10395EventSchema = kind10395EventTemplateSchema.merge(finalizedEventFields);
export function validate10395EventData(data) {
    kind10395ContentDecryptedDecodedSchema.parse(data);
    return data;
}
export function create10395EventTemplate(encryptedContent) {
    const template = {
        kind: NOTIFICATION_SUBSCRIPTION_KIND,
        content: encryptedContent,
        tags: [["p", NOTIFICATION_SERVER_PUBKEY]],
        created_at: getCurrentTimestamp(),
    };
    return template;
}
