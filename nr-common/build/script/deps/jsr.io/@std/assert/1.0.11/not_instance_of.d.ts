/**
 * Make an assertion that `obj` is not an instance of `type`.
 * If so, then throw.
 *
 * @example Usage
 * ```ts ignore
 * import { assertNotInstanceOf } from "@std/assert";
 *
 * assertNotInstanceOf(new Date(), Number); // Doesn't throw
 * assertNotInstanceOf(new Date(), Date); // Throws
 * ```
 *
 * @typeParam A The type of the object to check.
 * @typeParam T The type of the class to check against.
 * @param actual The object to check.
 * @param unexpectedType The class constructor to check against.
 * @param msg The optional message to display if the assertion fails.
 */
export declare function assertNotInstanceOf<A, T>(actual: A, unexpectedType: abstract new (...args: any[]) => T, msg?: string): asserts actual is Exclude<A, T>;
//# sourceMappingURL=not_instance_of.d.ts.map