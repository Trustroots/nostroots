import { z } from "../deps.js";
import { baseEventSchema, idSchema } from "./base.schema.js";
import { SERVER_MESSAGE_KIND, SERVER_MESSAGE_TYPE_TAG_NAME, SERVER_MESSAGE_TYPES, } from "../constants.js";
import { isHexKey } from "./utils.js";
function getFirstTagValue(tags, tagName) {
    const tag = tags.find(([name]) => name === tagName);
    return tag?.[1];
}
function isValidOptionalPubkey(tags) {
    const pubkey = getFirstTagValue(tags, "p");
    const hasNoPTag = typeof pubkey === "undefined";
    const isValidPubkey = typeof pubkey === "string" && isHexKey(pubkey);
    return hasNoPTag || isValidPubkey;
}
function isValidOptionalEventId(tags) {
    const eventId = getFirstTagValue(tags, "e");
    const hasNoETag = typeof eventId === "undefined";
    const isValidId = typeof eventId === "string" && idSchema.safeParse(eventId).success;
    return hasNoETag || isValidId;
}
function isValidOptionalMessageType(tags) {
    const messageType = getFirstTagValue(tags, SERVER_MESSAGE_TYPE_TAG_NAME);
    const hasNoMessageType = typeof messageType === "undefined";
    const isKnownType = typeof messageType === "string" &&
        SERVER_MESSAGE_TYPES.includes(messageType);
    return hasNoMessageType || isKnownType;
}
export const kind20398EventSchema = baseEventSchema.extend({
    kind: z.literal(SERVER_MESSAGE_KIND),
    content: z.string().min(1),
    tags: z
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
        message: `serverMessageType tag must be one of: ${SERVER_MESSAGE_TYPES.join(", ")}`,
    }),
});
