/** Assertion condition for {@linkcode assertFalse}. */
export type Falsy = false | 0 | 0n | "" | null | undefined;
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
export declare function assertFalse(expr: unknown, msg?: string): asserts expr is Falsy;
//# sourceMappingURL=false.d.ts.map