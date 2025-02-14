"use strict";
// Copyright 2018-2025 the Deno authors. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEqualErrorMessage = buildEqualErrorMessage;
exports.buildNotEqualErrorMessage = buildNotEqualErrorMessage;
const build_message_js_1 = require("../../internal/1.0.5/build_message.js");
const diff_js_1 = require("../../internal/1.0.5/diff.js");
const diff_str_js_1 = require("../../internal/1.0.5/diff_str.js");
const format_js_1 = require("../../internal/1.0.5/format.js");
function isString(value) {
    return typeof value === "string";
}
function buildEqualErrorMessage(actual, expected, options) {
    const { formatter = format_js_1.format, msg } = options ?? {};
    const msgPrefix = msg ? `${msg}: ` : "";
    const actualString = formatter(actual);
    const expectedString = formatter(expected);
    let message = `${msgPrefix}Values are not equal.`;
    const stringDiff = isString(actual) && isString(expected);
    const diffResult = stringDiff
        ? (0, diff_str_js_1.diffStr)(actual, expected)
        : (0, diff_js_1.diff)(actualString.split("\n"), expectedString.split("\n"));
    const diffMsg = (0, build_message_js_1.buildMessage)(diffResult, { stringDiff }).join("\n");
    message = `${message}\n${diffMsg}`;
    return message;
}
function buildNotEqualErrorMessage(actual, expected, options) {
    const { msg } = options ?? {};
    const actualString = String(actual);
    const expectedString = String(expected);
    const msgPrefix = msg ? `${msg}: ` : "";
    return `${msgPrefix}Expected actual: ${actualString} not to be: ${expectedString}.`;
}
