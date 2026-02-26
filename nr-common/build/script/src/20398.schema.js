"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kind20398EventSchema = void 0;
const deps_js_1 = require("../deps.js");
const base_schema_js_1 = require("./base.schema.js");
const constants_js_1 = require("../constants.js");
const utils_js_1 = require("./utils.js");
function getFirstTagValue(tags, tagName) {
    const tag = tags.find(([name]) => name === tagName);
    return tag?.[1];
}
function isValidOptionalPubkey(tags) {
    const pubkey = getFirstTagValue(tags, "p");
    const hasNoPTag = typeof pubkey === "undefined";
    const isValidPubkey = typeof pubkey === "string" && (0, utils_js_1.isHexKey)(pubkey);
    return hasNoPTag || isValidPubkey;
}
function isValidOptionalEventId(tags) {
    const eventId = getFirstTagValue(tags, "e");
    const hasNoETag = typeof eventId === "undefined";
    const isValidId = typeof eventId === "string" && base_schema_js_1.idSchema.safeParse(eventId).success;
    return hasNoETag || isValidId;
}
function isValidOptionalMessageType(tags) {
    const messageType = getFirstTagValue(tags, constants_js_1.SERVER_MESSAGE_TYPE_TAG_NAME);
    const hasNoMessageType = typeof messageType === "undefined";
    const isKnownType = typeof messageType === "string" &&
        constants_js_1.SERVER_MESSAGE_TYPES.includes(messageType);
    return hasNoMessageType || isKnownType;
}
exports.kind20398EventSchema = base_schema_js_1.baseEventSchema.extend({
    kind: deps_js_1.z.literal(constants_js_1.SERVER_MESSAGE_KIND),
    content: deps_js_1.z.string().min(1),
    tags: deps_js_1.z
        .string()
        .array()
        .array()
        .refine(isValidOptionalPubkey, {
        message: "p tag must be a valid 64-char hex pubkey",
    })
        .refine(isValidOptionalEventId, {
        message: "e tag must be a valid 64-char hex event id",
    })
        .refine(isValidOptionalMessageType, {
        message: `serverMessageType tag must be one of: ${constants_js_1.SERVER_MESSAGE_TYPES.join(", ")}`,
    }),
});
