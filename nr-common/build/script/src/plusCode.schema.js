"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlusCodeSchema = void 0;
const deps_js_1 = require("../deps.js");
const utils_js_1 = require("./utils.js");
exports.PlusCodeSchema = deps_js_1.z
    .string()
    .min(9, "Plus code must be 9 or more characters #INU7zO")
    .refine((maybePlusCode) => (0, utils_js_1.isPlusCode)(maybePlusCode), "Must be valid plus code #PeCssP");
