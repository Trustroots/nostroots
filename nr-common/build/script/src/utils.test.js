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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
require("../_dnt.test_polyfills.js");
const dntShim = __importStar(require("../_dnt.test_shims.js"));
const mod_js_1 = require("../deps/jsr.io/@std/expect/1.0.13/mod.js");
const utils_js_1 = require("./utils.js");
dntShim.Deno.test("#QX3iok Tags with namespace and no value returns false", () => {
    const tags = [
        ["L", "open-location-code"],
        ["L", "foo"],
        ["l", "bar", "foo"],
    ];
    (0, mod_js_1.expect)((0, utils_js_1.isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue)(tags)).toBe(false);
});
dntShim.Deno.test("#QkbuAn Tags with namespace and value returns true", () => {
    const tags = [
        ["L", "open-location-code"],
        ["l", "CC000000+", "open-location-code"],
        ["L", "foo"],
        ["l", "bar", "foo"],
    ];
    (0, mod_js_1.expect)((0, utils_js_1.isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue)(tags)).toBe(true);
});
dntShim.Deno.test("#qdp7pp Tags with two char username returns false", () => {
    const tags = [
        ["L", "open-location-code"],
        ["l", "CC000000+", "open-location-code"],
        ["L", "org.trustroots:username"],
        ["l", "ab", "org.trustroots:username"],
    ];
    (0, mod_js_1.expect)((0, utils_js_1.isValidTagsArrayWithTrustrootsUsername)(tags)).toBe(false);
});
dntShim.Deno.test("#6kqkIj Tags with four char username returns true", () => {
    const tags = [
        ["L", "open-location-code"],
        ["l", "CC000000+", "open-location-code"],
        ["L", "org.trustroots:username"],
        ["l", "abcd", "org.trustroots:username"],
    ];
    (0, mod_js_1.expect)((0, utils_js_1.isValidTagsArrayWithTrustrootsUsername)(tags)).toBe(true);
});
dntShim.Deno.test("#v91hjr Tags with username namespace and no value returns false", () => {
    const tags = [
        ["L", "foo"],
        ["l", "bar", "foo"],
        ["L", "org.trustroots:username"],
    ];
    (0, mod_js_1.expect)((0, utils_js_1.isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue)(tags)).toBe(false);
});
