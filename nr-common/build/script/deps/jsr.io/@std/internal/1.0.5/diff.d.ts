import type { DiffResult, DiffType } from "./types.js";
/** Represents the farthest point in the diff algorithm. */
export interface FarthestPoint {
    /** The y-coordinate of the point. */
    y: number;
    /** The id of the point. */
    id: number;
}
/**
 * Creates an array of common elements between two arrays.
 *
 * @typeParam T The type of elements in the arrays.
 *
 * @param A The first array.
 * @param B The second array.
 *
 * @returns An array containing the common elements between the two arrays.
 *
 * @example Usage
 * ```ts
 * import { createCommon } from "@std/internal/diff";
 * import { assertEquals } from "@std/assert";
 *
 * const a = [1, 2, 3];
 * const b = [1, 2, 4];
 *
 * assertEquals(createCommon(a, b), [1, 2]);
 * ```
 */
export declare function createCommon<T>(A: T[], B: T[]): T[];
/**
 * Asserts that the value is a {@linkcode FarthestPoint}.
 * If not, an error is thrown.
 *
 * @param value The value to check.
 *
 * @returns A void value that returns once the assertion completes.
 *
 * @example Usage
 * ```ts
 * import { assertFp } from "@std/internal/diff";
 * import { assertThrows } from "@std/assert";
 *
 * assertFp({ y: 0, id: 0 });
 * assertThrows(() => assertFp({ id: 0 }));
 * assertThrows(() => assertFp({ y: 0 }));
 * assertThrows(() => assertFp(undefined));
 * ```
 */
export declare function assertFp(value: unknown): asserts value is FarthestPoint;
/**
 * Creates an array of backtraced differences.
 *
 * @typeParam T The type of elements in the arrays.
 *
 * @param A The first array.
 * @param B The second array.
 * @param current The current {@linkcode FarthestPoint}.
 * @param swapped Boolean indicating if the arrays are swapped.
 * @param routes The routes array.
 * @param diffTypesPtrOffset The offset of the diff types in the routes array.
 *
 * @returns An array of backtraced differences.
 *
 * @example Usage
 * ```ts
 * import { backTrace } from "@std/internal/diff";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(
 *   backTrace([], [], { y: 0, id: 0 }, false, new Uint32Array(0), 0),
 *   [],
 * );
 * ```
 */
export declare function backTrace<T>(A: T[], B: T[], current: FarthestPoint, swapped: boolean, routes: Uint32Array, diffTypesPtrOffset: number): Array<{
    type: DiffType;
    value: T;
}>;
/**
 * Creates a {@linkcode FarthestPoint}.
 *
 * @param k The current index.
 * @param M The length of the first array.
 * @param routes The routes array.
 * @param diffTypesPtrOffset The offset of the diff types in the routes array.
 * @param ptr The current pointer.
 * @param slide The slide {@linkcode FarthestPoint}.
 * @param down The down {@linkcode FarthestPoint}.
 *
 * @returns A {@linkcode FarthestPoint}.
 *
 * @example Usage
 * ```ts
 * import { createFp } from "@std/internal/diff";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(
 *   createFp(
 *     0,
 *     0,
 *     new Uint32Array(0),
 *     0,
 *     0,
 *     { y: -1, id: 0 },
 *     { y: 0, id: 0 },
 *   ),
 *   { y: -1, id: 1 },
 * );
 * ```
 */
export declare function createFp(k: number, M: number, routes: Uint32Array, diffTypesPtrOffset: number, ptr: number, slide?: FarthestPoint, down?: FarthestPoint): FarthestPoint;
/**
 * Renders the differences between the actual and expected values.
 *
 * @typeParam T The type of elements in the arrays.
 *
 * @param A Actual value
 * @param B Expected value
 *
 * @returns An array of differences between the actual and expected values.
 *
 * @example Usage
 * ```ts
 * import { diff } from "@std/internal/diff";
 * import { assertEquals } from "@std/assert";
 *
 * const a = [1, 2, 3];
 * const b = [1, 2, 4];
 *
 * assertEquals(diff(a, b), [
 *   { type: "common", value: 1 },
 *   { type: "common", value: 2 },
 *   { type: "removed", value: 3 },
 *   { type: "added", value: 4 },
 * ]);
 * ```
 */
export declare function diff<T>(A: T[], B: T[]): DiffResult<T>[];
//# sourceMappingURL=diff.d.ts.map