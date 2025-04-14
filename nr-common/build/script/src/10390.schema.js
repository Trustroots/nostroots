"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kind10390EventSchema = exports.kind10390EventTemplateSchema = void 0;
exports.createKind10390EventTemplate = createKind10390EventTemplate;
const constants_js_1 = require("../constants.js");
const deps_js_1 = require("../deps.js");
const base_schema_js_1 = require("./base.schema.js");
const utils_js_1 = require("./utils.js");
/**
 * A kind 10390 event is a trustroots profile on nostr.
 *
 * So it's a nostr event, inspired by kind 0, that stores the trustroots
 * username as a tag value.
 */
exports.kind10390EventTemplateSchema = base_schema_js_1.baseEventTemplateSchema.extend({
    kind: deps_js_1.z.literal(10390),
    tags: deps_js_1.z
        .array(deps_js_1.z.array(deps_js_1.z.string()))
        .refine(utils_js_1.isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue, {
        message: "All label tags must have a value #2DPf9M",
    })
        .refine(utils_js_1.isValidTagsArrayWithTrustrootsUsername, {
        message: "Must have a valid trustroots username #KV4da8",
    }),
});
exports.kind10390EventSchema = exports.kind10390EventTemplateSchema.merge(base_schema_js_1.finalizedEventFields);
function createKind10390EventTemplate(trustrootsUsername) {
    const eventTemplate = {
        kind: constants_js_1.TRUSTROOTS_PROFILE_KIND,
        tags: [
            ["L", constants_js_1.TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
            ["l", trustrootsUsername, constants_js_1.TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
        ],
        content: "",
        created_at: (0, utils_js_1.getCurrentTimestamp)(),
    };
    return eventTemplate;
}
