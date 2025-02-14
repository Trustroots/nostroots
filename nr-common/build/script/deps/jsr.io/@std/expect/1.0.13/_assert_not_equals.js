"use strict";
// Copyright 2018-2025 the Deno authors. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertNotEquals = assertNotEquals;
// This file is copied from `std/assert`.
const assertion_error_js_1 = require("../../assert/1.0.11/assertion_error.js");
const _build_message_js_1 = require("./_build_message.js");
const _equal_js_1 = require("./_equal.js");
/**
 * Make an assertion that `actual` and `expected` are not equal, deeply.
 * If not then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 *
 * @example
 * ```ts ignore
 * import { assertNotEquals } from "@std/assert";
 *
 * assertNotEquals(1, 2); // Doesn't throw
 * assertNotEquals(1, 1); // Throws
 * ```
 */
function assertNotEquals(actual, expected, options = {}) {
    if (!(0, _equal_js_1.equal)(actual, expected, options)) {
        return;
    }
    const message = (0, _build_message_js_1.buildNotEqualErrorMessage)(actual, expected, options ?? {});
    throw new assertion_error_js_1.AssertionError(message);
}
