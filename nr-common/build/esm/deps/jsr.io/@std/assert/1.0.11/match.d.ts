/**
 * Make an assertion that `actual` match RegExp `expected`. If not
 * then throw.
 *
 * @example Usage
 * ```ts ignore
 * import { assertMatch } from "@std/assert";
 *
 * assertMatch("Raptor", /Raptor/); // Doesn't throw
 * assertMatch("Denosaurus", /Raptor/); // Throws
 * ```
 *
 * @param actual The actual value to be matched.
 * @param expected The expected pattern to match.
 * @param msg The optional message to display if the assertion fails.
 */
export declare function assertMatch(actual: string, expected: RegExp, msg?: string): void;
//# sourceMappingURL=match.d.ts.map