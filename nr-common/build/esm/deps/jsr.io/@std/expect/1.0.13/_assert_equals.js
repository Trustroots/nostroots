// Copyright 2018-2025 the Deno authors. MIT license.
// This file is copied from `std/assert`.
import { AssertionError } from "../../assert/1.0.11/assertion_error.js";
import { buildEqualErrorMessage } from "./_build_message.js";
import { equal } from "./_equal.js";
/**
 * Make an assertion that `actual` and `expected` are equal, deeply. If not
 * deeply equal, then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the
 * same type.
 *
 * @example
 * ```ts ignore
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals("world", "world"); // Doesn't throw
 * assertEquals("hello", "world"); // Throws
 * ```
 *
 * Note: formatter option is experimental and may be removed in the future.
 */
export function assertEquals(actual, expected, options) {
    if (equal(actual, expected, options)) {
        return;
    }
    const message = buildEqualErrorMessage(actual, expected, options ?? {});
    throw new AssertionError(message);
}
