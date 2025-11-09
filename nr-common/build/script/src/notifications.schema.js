"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationDataSchema = exports.EventJSONNotificationDataSchema = exports.EventNotificationDataSchema = void 0;
const deps_js_1 = require("../deps.js");
const event_schema_js_1 = require("./event.schema.js");
exports.EventNotificationDataSchema = deps_js_1.z.object({
    type: deps_js_1.z.literal("event"),
    event: event_schema_js_1.eventSchema,
});
exports.EventJSONNotificationDataSchema = deps_js_1.z.object({
    type: deps_js_1.z.literal("eventJSON"),
    event: deps_js_1.z.string().refine((input) => {
        try {
            const event = JSON.parse(input);
            event_schema_js_1.eventSchema.parse(event);
            return true;
        }
        catch {
            return false;
        }
    }, "Event JSON invalid #r48BWE"),
});
exports.NotificationDataSchema = deps_js_1.z.discriminatedUnion("type", [
    exports.EventNotificationDataSchema,
    exports.EventJSONNotificationDataSchema,
]);
