"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertFalse = assertFalse;
// Copyright 2018-2025 the Deno authors. MIT license.
// This module is browser compatible.
const assertion_error_js_1 = require("./assertion_error.js");
/**
 * Make an assertion, error will be thrown if `expr` have truthy value.
 *
 * @example Usage
 * ```ts ignore
 * import { assertFalse } from "@std/assert";
 *
 * assertFalse(false); // Doesn't throw
 * assertFalse(true); // Throws
 * ```
 *
 * @param expr The expression to test.
 * @param msg The optional message to display if the assertion fails.
 */
function assertFalse(expr, msg = "") {
    if (expr) {
        throw new assertion_error_js_1.AssertionError(msg);
    }
}
