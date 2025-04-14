"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentSchema = exports.tagsIncludingPlusCodeSchema = exports.baseEventSchema = exports.finalizedEventFields = exports.baseEventTemplateSchema = void 0;
const constants_js_1 = require("../constants.js");
const deps_js_1 = require("../deps.js");
const utils_js_1 = require("./utils.js");
exports.baseEventTemplateSchema = deps_js_1.z.object({
    kind: deps_js_1.z.number(),
    created_at: deps_js_1.z.number(),
    tags: deps_js_1.z.string().array().array(),
    content: deps_js_1.z.string(),
});
exports.finalizedEventFields = deps_js_1.z.object({
    id: deps_js_1.z.string().length(64),
    pubkey: deps_js_1.z.string().length(64),
    sig: deps_js_1.z.string(),
});
exports.baseEventSchema = exports.baseEventTemplateSchema
    .merge(exports.finalizedEventFields)
    .strict();
exports.tagsIncludingPlusCodeSchema = deps_js_1.z
    .string()
    .array()
    .array()
    .refine((tags) => {
    const plusCode = (0, utils_js_1.getFirstLabelValueFromTags)(tags, constants_js_1.OPEN_LOCATION_CODE_TAG_NAME);
    if (typeof plusCode === "undefined" || !(0, utils_js_1.isPlusCode)(plusCode)) {
        return false;
    }
    return true;
}, { message: "Tags have invalid or missing plus code" });
exports.contentSchema = deps_js_1.z
    .string()
    .max(constants_js_1.CONTENT_MAXIMUM_LENGTH, `content is above max length of ${constants_js_1.CONTENT_MAXIMUM_LENGTH}`)
    .min(constants_js_1.CONTENT_MINIMUM_LENGTH, `content is below min length of ${constants_js_1.CONTENT_MINIMUM_LENGTH}`);
