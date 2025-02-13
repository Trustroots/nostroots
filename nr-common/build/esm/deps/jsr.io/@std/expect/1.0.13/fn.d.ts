/**
 * Creates a mock function that can be used for testing and assertions.
 *
 * @param stubs Functions to be used as stubs for different calls.
 * @returns A mock function that keeps track of calls and returns values based on the provided stubs.
 *
 * @example Usage
 * ```ts no-assert
 * import { fn, expect } from "@std/expect";
 *
 * Deno.test("example", () => {
 *   const mockFn = fn(
 *     (a: number, b: number) => a + b,
 *     (a: number, b: number) => a - b
 *   );
 *   const result = mockFn(1, 2);
 *   expect(result).toEqual(3);
 *   expect(mockFn).toHaveBeenCalledWith(1, 2);
 *   expect(mockFn).toHaveBeenCalledTimes(1);
 *
 *   const result2 = mockFn(3, 2);
 *   expect(result2).toEqual(1);
 *   expect(mockFn).toHaveBeenCalledWith(3, 2);
 *   expect(mockFn).toHaveBeenCalledTimes(2);
 * });
 * ```
 */
export declare function fn(...stubs: Function[]): Function;
//# sourceMappingURL=fn.d.ts.map