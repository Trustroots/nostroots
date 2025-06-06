"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kind10395EventSchema = exports.kind10395EventTemplateSchema = exports.kind10395ContentDecryptedDecodedSchema = exports.kind10395SubscriptionFilterSchema = exports.expoPushTokenListSchema = void 0;
exports.validate10395EventData = validate10395EventData;
exports.create10395EventTemplate = create10395EventTemplate;
const constants_js_1 = require("../constants.js");
const deps_js_1 = require("../deps.js");
const base_schema_js_1 = require("./base.schema.js");
const filter_schema_js_1 = require("./filter.schema.js");
const utils_js_1 = require("./utils.js");
/**
 * A kind 10395 event is an event where the user specifies what nostr events
 * they want to receive a push notification about. They do that by specifying a
 * set of nostr filters, and by providing their apple / google push token. This
 * takes the form of a NIP04 encrypted event which is encrypted for the
 * notification server's private key.
 */
exports.expoPushTokenListSchema = deps_js_1.z
    .object({
    expoPushToken: deps_js_1.z.string(),
})
    .array();
exports.kind10395SubscriptionFilterSchema = deps_js_1.z
    .object({
    filter: filter_schema_js_1.filterSchema,
})
    .array();
exports.kind10395ContentDecryptedDecodedSchema = deps_js_1.z.object({
    tokens: exports.expoPushTokenListSchema,
    filters: exports.kind10395SubscriptionFilterSchema,
});
exports.kind10395EventTemplateSchema = base_schema_js_1.baseEventTemplateSchema.extend({
    kind: deps_js_1.z.literal(constants_js_1.NOTIFICATION_SUBSCRIPTION_KIND),
    // TODO Enable version check
    content: deps_js_1.z.string(),
});
exports.kind10395EventSchema = exports.kind10395EventTemplateSchema.merge(base_schema_js_1.finalizedEventFields);
function validate10395EventData(data) {
    exports.kind10395ContentDecryptedDecodedSchema.parse(data);
    return data;
}
function create10395EventTemplate(encryptedContent) {
    const template = {
        kind: constants_js_1.NOTIFICATION_SUBSCRIPTION_KIND,
        content: encryptedContent,
        tags: [["p", constants_js_1.NOTIFICATION_SERVER_PUBKEY]],
        created_at: (0, utils_js_1.getCurrentTimestamp)(),
    };
    return template;
}
