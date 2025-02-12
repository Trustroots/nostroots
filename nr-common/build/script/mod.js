"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kind30397EventSchema = exports.kind30398EventSchema = exports.contentSchema = exports.tagsIncludingPlusCodeSchema = exports.eventSchema = exports.CONTENT_MAXIMUM_LENGTH = exports.CONTENT_MINIMUM_LENGTH = void 0;
exports.isValidEvent = isValidEvent;
const constants_js_1 = require("./constants.js");
const deps_js_1 = require("./deps.js");
const utils_js_1 = require("./utils.js");
__exportStar(require("./utils.js"), exports);
__exportStar(require("./constants.js"), exports);
// import { version as PACKAGE_VERSION } from "./deno.json" with { type: "json" };
exports.CONTENT_MINIMUM_LENGTH = 3;
exports.CONTENT_MAXIMUM_LENGTH = 300;
const PACKAGE_VERSION = "0.0.1";
exports.eventSchema = deps_js_1.z
    .object({
    id: deps_js_1.z.string().length(64),
    pubkey: deps_js_1.z.string().length(64),
    kind: deps_js_1.z.number(),
    created_at: deps_js_1.z.number(),
    tags: deps_js_1.z.string().array().array(),
    content: deps_js_1.z.string(),
    sig: deps_js_1.z.string(),
})
    .strict();
function hasOpenLocationCode(tags) {
    const namespaces = tags
        .filter((tag) => tag[0] === "L")
        .map((tag) => tag.slice(1))
        .flat();
    const hasOpenLocationCodeNamespace = namespaces.includes(constants_js_1.OPEN_LOCATION_CODE_TAG_NAME);
    if (!hasOpenLocationCodeNamespace)
        return false;
    const plusCodeTags = tags.filter((tag) => tag.length > 3 && tag[0] === "l" && tag[2] === constants_js_1.OPEN_LOCATION_CODE_TAG_NAME);
    if (plusCodeTags.length === 0)
        return false;
    const plusCodes = plusCodeTags.map((plusCodeTag) => plusCodeTag[1]);
    const validPlusCodes = plusCodes.every(utils_js_1.isPlusCode);
    if (!validPlusCodes)
        return false;
    return true;
}
function hasVersion(tags) {
    const versionTags = tags.filter((tag) => tag[0] === "kind30398_version");
    if (versionTags.length !== 1)
        return false;
    const versionTag = versionTags[0];
    if (versionTag.length !== 2)
        return false;
    const version = versionTag[1];
    if (version !== PACKAGE_VERSION)
        return false;
    return true;
}
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
    .max(exports.CONTENT_MAXIMUM_LENGTH, `content is above max length of ${exports.CONTENT_MAXIMUM_LENGTH}`)
    .min(exports.CONTENT_MINIMUM_LENGTH, `content is below min length of ${exports.CONTENT_MINIMUM_LENGTH}`);
exports.kind30398EventSchema = exports.eventSchema.extend({
    kind: deps_js_1.z.literal(30398),
    // TODO Enable version check
    tags: exports.tagsIncludingPlusCodeSchema,
    // tags: tagsIncludingPlusCodeSchema.refine(hasVersion, {
    //   message: "no valid kind30398_version",
    // }),
    content: exports.contentSchema,
});
exports.kind30397EventSchema = exports.eventSchema.extend({
    kind: deps_js_1.z.literal(30397),
    // TODO Enable version check
    tags: exports.tagsIncludingPlusCodeSchema,
    // tags: tagsIncludingPlusCodeSchema.refine(hasVersion, {
    //   message: "no valid kind30397_version",
    // }),
    content: exports.contentSchema,
});
function isValidEvent(event) {
    const { kind } = event;
    switch (kind) {
        case 30397: {
            const { success } = exports.kind30397EventSchema.safeParse(event);
            return success;
        }
        case 30398: {
            const { success } = exports.kind30398EventSchema.safeParse(event);
            return success;
        }
    }
    const { success } = exports.eventSchema.safeParse(event);
    return success;
}
