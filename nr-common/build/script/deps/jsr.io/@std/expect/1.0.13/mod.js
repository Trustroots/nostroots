"use strict";
// Copyright 2018-2025 the Deno authors. MIT license.
// Copyright 2019 Allain Lalonde. All rights reserved. ISC License.
// This module is browser compatible.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * This module provides Jest compatible expect assertion functionality.
 *
 * ```ts no-assert
 * import { expect } from "@std/expect";
 *
 * const x = 6 * 7;
 * expect(x).toEqual(42);
 * expect(x).not.toEqual(0);
 *
 * await expect(Promise.resolve(x)).resolves.toEqual(42);
 * ```
 *
 * Currently this module supports the following functions:
 * - Common matchers:
 *   - {@linkcode Expected.toBe | toBe}
 *   - {@linkcode Expected.toEqual | toEqual}
 *   - {@linkcode Expected.toStrictEqual | toStrictEqual}
 *   - {@linkcode Expected.toMatch | toMatch}
 *   - {@linkcode Expected.toMatchObject | toMatchObject}
 *   - {@linkcode Expected.toBeDefined | toBeDefined}
 *   - {@linkcode Expected.toBeUndefined | toBeUndefined}
 *   - {@linkcode Expected.toBeNull | toBeNull}
 *   - {@linkcode Expected.toBeNaN | toBeNaN}
 *   - {@linkcode Expected.toBeTruthy | toBeTruthy}
 *   - {@linkcode Expected.toBeFalsy | toBeFalsy}
 *   - {@linkcode Expected.toContain | toContain}
 *   - {@linkcode Expected.toContainEqual | toContainEqual}
 *   - {@linkcode Expected.toHaveLength | toHaveLength}
 *   - {@linkcode Expected.toBeGreaterThan | toBeGreaterThan}
 *   - {@linkcode Expected.toBeGreaterThanOrEqual | toBeGreaterThanOrEqual}
 *   - {@linkcode Expected.toBeLessThan | toBeLessThan}
 *   - {@linkcode Expected.toBeLessThanOrEqual | toBeLessThanOrEqual}
 *   - {@linkcode Expected.toBeCloseTo | toBeCloseTo}
 *   - {@linkcode Expected.toBeInstanceOf | toBeInstanceOf}
 *   - {@linkcode Expected.toThrow | toThrow}
 *   - {@linkcode Expected.toHaveProperty | toHaveProperty}
 * - Mock related matchers:
 *   - {@linkcode Expected.toHaveBeenCalled | toHaveBeenCalled}
 *   - {@linkcode Expected.toHaveBeenCalledTimes | toHaveBeenCalledTimes}
 *   - {@linkcode Expected.toHaveBeenCalledWith | toHaveBeenCalledWith}
 *   - {@linkcode Expected.toHaveBeenLastCalledWith | toHaveBeenLastCalledWith}
 *   - {@linkcode Expected.toHaveBeenNthCalledWith | toHaveBeenNthCalledWith}
 *   - {@linkcode Expected.toHaveReturned | toHaveReturned}
 *   - {@linkcode Expected.toHaveReturnedTimes | toHaveReturnedTimes}
 *   - {@linkcode Expected.toHaveReturnedWith | toHaveReturnedWith}
 *   - {@linkcode Expected.toHaveLastReturnedWith | toHaveLastReturnedWith}
 *   - {@linkcode Expected.toHaveNthReturnedWith | toHaveNthReturnedWith}
 * - Asymmetric matchers:
 *   - {@linkcode expect.anything}
 *   - {@linkcode expect.any}
 *   - {@linkcode expect.arrayContaining}
 *   - {@linkcode expect.not.arrayContaining}
 *   - {@linkcode expect.objectContaining}
 *   - {@linkcode expect.not.objectContaining}
 *   - {@linkcode expect.closeTo}
 *   - {@linkcode expect.stringContaining}
 *   - {@linkcode expect.not.stringContaining}
 *   - {@linkcode expect.stringMatching}
 *   - {@linkcode expect.not.stringMatching}
 * - Utilities:
 *   - {@linkcode expect.addSnapshotSerializer}
 *   - {@linkcode expect.assertions}
 *   - {@linkcode expect.addEqualityTester}
 *   - {@linkcode expect.extend}
 *   - {@linkcode expect.hasAssertions}
 *
 * Only these functions are still not available:
 * - Matchers:
 *   - `toMatchSnapshot`
 *   - `toMatchInlineSnapshot`
 *   - `toThrowErrorMatchingSnapshot`
 *   - `toThrowErrorMatchingInlineSnapshot`
 *
 * The tracking issue to add support for unsupported parts of the API is
 * {@link https://github.com/denoland/std/issues/3964}.
 *
 * This module is largely inspired by
 * {@link https://github.com/allain/expect | x/expect} module by
 * {@link https://github.com/allain | Allain Lalonde}.
 *
 * @module
 */
__exportStar(require("./expect.js"), exports);
__exportStar(require("./fn.js"), exports);
