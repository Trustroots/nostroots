"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kind10390EventSchema = void 0;
const deps_js_1 = require("../deps.js");
const utils_js_1 = require("./utils.js");
const base_schema_js_1 = require("./base.schema.js");
exports.kind10390EventSchema = base_schema_js_1.baseEventSchema.extend({
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
