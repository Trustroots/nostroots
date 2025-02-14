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
export declare function assertNotEquals<T>(actual: T, expected: T, options?: EqualOptions): void;
//# sourceMappingURL=_assert_not_equals.d.ts.map