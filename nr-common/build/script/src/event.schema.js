"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventSchema = void 0;
const _10390_schema_js_1 = require("./10390.schema.js");
const _10395_schema_js_1 = require("./10395.schema.js");
const _30397_schema_js_1 = require("./30397.schema.js");
const _30398_schema_js_1 = require("./30398.schema.js");
const base_schema_js_1 = require("./base.schema.js");
exports.eventSchema = base_schema_js_1.baseEventSchema.refine((event) => {
    const { kind } = event;
    switch (kind) {
        case 10390: {
            const { success } = _10390_schema_js_1.kind10390EventSchema.safeParse(event);
            return success;
        }
        case 10395: {
            const { success } = _10395_schema_js_1.kind10395EventSchema.safeParse(event);
            return success;
        }
        case 30397: {
            const { success } = _30397_schema_js_1.kind30397EventSchema.safeParse(event);
            return success;
        }
        case 30398: {
            const { success } = _30398_schema_js_1.kind30398EventSchema.safeParse(event);
            return success;
        }
    }
    const { success } = base_schema_js_1.baseEventSchema.safeParse(event);
    return success;
});
