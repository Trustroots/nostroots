// Copyright 2018-2025 the Deno authors. MIT license.

// This file is copied from `std/assert`.

import { AssertionError } from "../../assert/1.0.11/assertion_error.js";
import { buildNotEqualErrorMessage } from "./_build_message.js";
import { equal } from "./_equal.js";
import type { EqualOptions } from "./_types.js";

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
export function assertNotEquals<T>(
  actual: T,
  expected: T,
  options: EqualOptions = {},
) {
  if (!equal(actual, expected, options)) {
    return;
  }

  const message = buildNotEqualErrorMessage(actual, expected, options ?? {});
  throw new AssertionError(message);
}
