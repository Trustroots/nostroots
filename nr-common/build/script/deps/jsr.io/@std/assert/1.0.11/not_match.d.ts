/**
 * Make an assertion that `actual` not match RegExp `expected`. If match
 * then throw.
 *
 * @example Usage
 * ```ts ignore
 * import { assertNotMatch } from "@std/assert";
 *
 * assertNotMatch("Denosaurus", /Raptor/); // Doesn't throw
 * assertNotMatch("Raptor", /Raptor/); // Throws
 * ```
 *
 * @param actual The actual value to match.
 * @param expected The expected value to not match.
 * @param msg The optional message to display if the assertion fails.
 */
export declare function assertNotMatch(actual: string, expected: RegExp, msg?: string): void;
//# sourceMappingURL=not_match.d.ts.map