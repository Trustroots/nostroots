"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventSchema = void 0;
const constants_js_1 = require("../constants.js");
const constants_js_2 = require("../constants.js");
const _10390_schema_js_1 = require("./10390.schema.js");
const _10395_schema_js_1 = require("./10395.schema.js");
const _30397_schema_js_1 = require("./30397.schema.js");
const _30398_schema_js_1 = require("./30398.schema.js");
const base_schema_js_1 = require("./base.schema.js");
// TODO - Improve failures here
exports.eventSchema = base_schema_js_1.baseEventSchema
    .refine((event) => {
    const { kind } = event;
    if (kind === constants_js_2.TRUSTROOTS_PROFILE_KIND) {
        const { success } = _10390_schema_js_1.kind10390EventSchema.safeParse(event);
        return success;
    }
    return true;
}, { message: "#ORzfDS-kind-10390-schema-failed" })
    .refine((event) => {
    const { kind } = event;
    if (kind === constants_js_2.NOTIFICATION_SUBSCRIPTION_KIND) {
        const { success } = _10395_schema_js_1.kind10395EventSchema.safeParse(event);
        return success;
    }
    return true;
}, { message: "#4P6NFR-kind-10395-schema-failed" })
    .refine((event) => {
    const { kind } = event;
    if (kind === constants_js_2.MAP_NOTE_KIND) {
        const { success } = _30397_schema_js_1.kind30397EventSchema.safeParse(event);
        return success;
    }
    return true;
}, { message: "#zqKj3t-kind-30397-schema-failed" })
    .refine((event) => {
    const { kind } = event;
    if (kind === constants_js_1.MAP_NOTE_REPOST_KIND) {
        const { success } = _30398_schema_js_1.kind30398EventSchema.safeParse(event);
        return success;
    }
    return true;
}, { message: "#1WlNEs-kind-30398-schema-failed" })
    .refine((event) => {
    const { success } = base_schema_js_1.baseEventSchema.safeParse(event);
    return success;
}, { message: "#wuKVfX-base-event-schema-failed" });
