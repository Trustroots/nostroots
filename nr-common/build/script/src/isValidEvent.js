"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidEvent = isValidEvent;
const constants_js_1 = require("../constants.js");
const _10390_schema_js_1 = require("./10390.schema.js");
const _10395_schema_js_1 = require("./10395.schema.js");
const _30397_schema_js_1 = require("./30397.schema.js");
const _30398_schema_js_1 = require("./30398.schema.js");
const base_schema_js_1 = require("./base.schema.js");
function isValidEvent(event) {
    try {
        switch (event.kind) {
            case constants_js_1.TRUSTROOTS_PROFILE_KIND:
                _10390_schema_js_1.kind10390EventSchema.parse(event);
                return true;
            case constants_js_1.NOTIFICATION_SUBSCRIPTION_KIND:
                _10395_schema_js_1.kind10395EventSchema.parse(event);
                return true;
            case constants_js_1.MAP_NOTE_KIND:
                _30397_schema_js_1.kind30397EventSchema.parse(event);
                return true;
            case constants_js_1.MAP_NOTE_REPOST_KIND:
                _30398_schema_js_1.kind30398EventSchema.parse(event);
                return true;
            default:
                base_schema_js_1.baseEventSchema.parse(event);
                return true;
        }
    }
    catch (_error) {
        return false;
    }
}
