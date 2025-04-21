"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthorFromEvent = getAuthorFromEvent;
const constants_js_1 = require("../constants.js");
const event_schema_js_1 = require("./event.schema.js");
const utils_js_1 = require("./utils.js");
function getAuthorFromEvent(event) {
    const result = event_schema_js_1.eventSchema.safeParse(event);
    if (!result.success) {
        return;
    }
    const parsedEvent = result.data;
    switch (parsedEvent.kind) {
        case constants_js_1.MAP_NOTE_REPOST_KIND: {
            const originalAuthorPublicKey = (0, utils_js_1.getFirstTagValueFromEvent)(event, "p");
            return originalAuthorPublicKey;
        }
        default:
            // TODO - Handle delegated signing and so on here
            return event.pubkey;
    }
}
