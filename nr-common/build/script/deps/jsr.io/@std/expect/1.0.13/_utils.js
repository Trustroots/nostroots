"use strict";
// Copyright 2018-2025 the Deno authors. MIT license.
// Copyright (c) Meta Platforms, Inc. and affiliates. All rights reserved. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEqualOptions = buildEqualOptions;
exports.isPromiseLike = isPromiseLike;
exports.hasIterator = hasIterator;
exports.isA = isA;
exports.iterableEquality = iterableEquality;
exports.subsetEquality = subsetEquality;
const _equal_js_1 = require("./_equal.js");
function buildEqualOptions(options) {
    const { customMessage, customTesters = [], strictCheck } = options ?? {};
    const ret = {
        customTesters,
    };
    if (customMessage !== undefined) {
        ret.msg = customMessage;
    }
    if (strictCheck !== undefined) {
        ret.strictCheck = strictCheck;
    }
    return ret;
}
function isPromiseLike(value) {
    if (value == null) {
        return false;
    }
    else {
        return typeof (value.then) === "function";
    }
}
// deno-lint-ignore no-explicit-any
function hasIterator(object) {
    return !!(object != null && object[Symbol.iterator]);
}
function isA(typeName, value) {
    return Object.prototype.toString.apply(value) === `[object ${typeName}]`;
}
function isObject(a) {
    return a !== null && typeof a === "object";
}
function isObjectWithKeys(a) {
    return (isObject(a) &&
        !(a instanceof Error) &&
        !Array.isArray(a) &&
        !(a instanceof Date) &&
        !(a instanceof Set) &&
        !(a instanceof Map));
}
function getObjectKeys(object) {
    return [
        ...Object.keys(object),
        ...Object.getOwnPropertySymbols(object).filter((s) => Object.getOwnPropertyDescriptor(object, s)?.enumerable),
    ];
}
function hasPropertyInObject(object, key) {
    const shouldTerminate = !object || typeof object !== "object" ||
        object === Object.prototype;
    if (shouldTerminate) {
        return false;
    }
    return (Object.prototype.hasOwnProperty.call(object, key) ||
        hasPropertyInObject(Object.getPrototypeOf(object), key));
}
// deno-lint-ignore no-explicit-any
function entries(obj) {
    if (!isObject(obj))
        return [];
    return Object.getOwnPropertySymbols(obj)
        .filter((key) => key !== Symbol.iterator)
        .map((key) => [key, obj[key]])
        .concat(Object.entries(obj));
}
// Ported from https://github.com/jestjs/jest/blob/442c7f692e3a92f14a2fb56c1737b26fc663a0ef/packages/expect-utils/src/utils.ts#L173
function iterableEquality(
// deno-lint-ignore no-explicit-any
a, 
// deno-lint-ignore no-explicit-any
b, customTesters = [], aStack = [], bStack = []) {
    if (typeof a !== "object" ||
        typeof b !== "object" ||
        Array.isArray(a) ||
        Array.isArray(b) ||
        !hasIterator(a) ||
        !hasIterator(b)) {
        return undefined;
    }
    if (a.constructor !== b.constructor) {
        return false;
    }
    let length = aStack.length;
    while (length--) {
        // Linear search. Performance is inversely proportional to the number of
        // unique nested structures.
        // circular references at same depth are equal
        // circular reference is not equal to non-circular one
        if (aStack[length] === a) {
            return bStack[length] === b;
        }
    }
    aStack.push(a);
    bStack.push(b);
    // deno-lint-ignore no-explicit-any
    const iterableEqualityWithStack = (a, b) => iterableEquality(a, b, [...filteredCustomTesters], [...aStack], [...bStack]);
    // Replace any instance of iterableEquality with the new
    // iterableEqualityWithStack so we can do circular detection
    const filteredCustomTesters = [
        ...customTesters.filter((t) => t !== iterableEquality),
        iterableEqualityWithStack,
    ];
    if (a.size !== undefined) {
        if (a.size !== b.size) {
            return false;
        }
        else if (isA("Set", a)) {
            let allFound = true;
            for (const aValue of a) {
                if (!b.has(aValue)) {
                    let has = false;
                    for (const bValue of b) {
                        const isEqual = (0, _equal_js_1.equal)(aValue, bValue, {
                            customTesters: filteredCustomTesters,
                        });
                        if (isEqual === true) {
                            has = true;
                        }
                    }
                    if (has === false) {
                        allFound = false;
                        break;
                    }
                }
            }
            // Remove the first value from the stack of traversed values.
            aStack.pop();
            bStack.pop();
            return allFound;
        }
        else if (isA("Map", a)) {
            let allFound = true;
            for (const aEntry of a) {
                if (!b.has(aEntry[0]) ||
                    !(0, _equal_js_1.equal)(aEntry[1], b.get(aEntry[0]), {
                        customTesters: filteredCustomTesters,
                    })) {
                    let has = false;
                    for (const bEntry of b) {
                        const matchedKey = (0, _equal_js_1.equal)(aEntry[0], bEntry[0], { customTesters: filteredCustomTesters });
                        let matchedValue = false;
                        if (matchedKey === true) {
                            matchedValue = (0, _equal_js_1.equal)(aEntry[1], bEntry[1], { customTesters: filteredCustomTesters });
                        }
                        if (matchedValue === true) {
                            has = true;
                        }
                    }
                    if (has === false) {
                        allFound = false;
                        break;
                    }
                }
            }
            // Remove the first value from the stack of traversed values.
            aStack.pop();
            bStack.pop();
            return allFound;
        }
    }
    const bIterator = b[Symbol.iterator]();
    for (const aValue of a) {
        const nextB = bIterator.next();
        if (nextB.done ||
            !(0, _equal_js_1.equal)(aValue, nextB.value, { customTesters: filteredCustomTesters })) {
            return false;
        }
    }
    if (!bIterator.next().done) {
        return false;
    }
    const aEntries = entries(a);
    const bEntries = entries(b);
    if (!(0, _equal_js_1.equal)(aEntries, bEntries)) {
        return false;
    }
    // Remove the first value from the stack of traversed values.
    aStack.pop();
    bStack.pop();
    return true;
}
// Ported from https://github.com/jestjs/jest/blob/442c7f692e3a92f14a2fb56c1737b26fc663a0ef/packages/expect-utils/src/utils.ts#L341
function subsetEquality(object, subset, customTesters = []) {
    const filteredCustomTesters = customTesters.filter((t) => t !== subsetEquality);
    const subsetEqualityWithContext = (seenReferences = new WeakMap()) => 
    // deno-lint-ignore no-explicit-any
    (object, subset) => {
        if (!isObjectWithKeys(subset)) {
            return undefined;
        }
        if (seenReferences.has(subset))
            return undefined;
        seenReferences.set(subset, true);
        const matchResult = getObjectKeys(subset).every((key) => {
            if (isObjectWithKeys(subset[key])) {
                if (seenReferences.has(subset[key])) {
                    return (0, _equal_js_1.equal)(object[key], subset[key], {
                        customTesters: filteredCustomTesters,
                    });
                }
            }
            const result = object != null &&
                hasPropertyInObject(object, key) &&
                (0, _equal_js_1.equal)(object[key], subset[key], {
                    customTesters: [
                        ...filteredCustomTesters,
                        subsetEqualityWithContext(seenReferences),
                    ],
                });
            seenReferences.delete(subset[key]);
            return result;
        });
        seenReferences.delete(subset);
        return matchResult;
    };
    return subsetEqualityWithContext()(object, subset);
}
