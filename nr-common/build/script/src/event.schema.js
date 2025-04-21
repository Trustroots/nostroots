"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventSchema = exports.kindSpecificEventSchema = void 0;
const deps_js_1 = require("../deps.js");
const _10390_schema_js_1 = require("./10390.schema.js");
const _10395_schema_js_1 = require("./10395.schema.js");
const _30397_schema_js_1 = require("./30397.schema.js");
const _30398_schema_js_1 = require("./30398.schema.js");
const base_schema_js_1 = require("./base.schema.js");
// TODO - Add the generic event filter now
exports.kindSpecificEventSchema = deps_js_1.z.discriminatedUnion("kind", [
    _10390_schema_js_1.kind10390EventSchema,
    _10395_schema_js_1.kind10395EventSchema,
    _30397_schema_js_1.kind30397EventSchema,
    _30398_schema_js_1.kind30398EventSchema,
]);
exports.eventSchema = exports.kindSpecificEventSchema.or(base_schema_js_1.baseEventSchema);
