"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kind30398EventSchema = void 0;
const deps_js_1 = require("../deps.js");
const base_schema_js_1 = require("./base.schema.js");
exports.kind30398EventSchema = base_schema_js_1.baseEventSchema.extend({
    kind: deps_js_1.z.literal(30398),
    // TODO Enable version check
    tags: base_schema_js_1.tagsIncludingPlusCodeSchema,
    // tags: tagsIncludingPlusCodeSchema.refine(hasVersion, {
    //   message: "no valid kind30398_version",
    // }),
    content: base_schema_js_1.contentSchema,
});
