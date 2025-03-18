"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kind10395EventSchema = exports.kind10395ContentDecodedSchema = exports.kind10395SubscriptionFilterSchema = void 0;
const constants_js_1 = require("../constants.js");
const deps_js_1 = require("../deps.js");
const base_schema_js_1 = require("./base.schema.js");
const filter_schema_js_1 = require("./filter.schema.js");
exports.kind10395SubscriptionFilterSchema = deps_js_1.z.object({
    filter: filter_schema_js_1.filterSchema,
});
exports.kind10395ContentDecodedSchema = deps_js_1.z.object({
    tokens: deps_js_1.z.object({}), // TODO Define the shape of this
    filters: exports.kind10395SubscriptionFilterSchema,
});
exports.kind10395EventSchema = base_schema_js_1.baseEventSchema.extend({
    kind: deps_js_1.z.literal(constants_js_1.NOTIFICATION_SUBSCRIPTION_KIND),
    // TODO Enable version check
    content: deps_js_1.z.string().refine((content) => {
        try {
            const result = JSON.parse(content);
            exports.kind10395ContentDecodedSchema.parse(result);
        }
        catch {
            return false;
        }
        return true;
    }),
});
