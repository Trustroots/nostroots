"use strict";
// Copyright 2018-2025 the Deno authors. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.toBe = toBe;
exports.toEqual = toEqual;
exports.toStrictEqual = toStrictEqual;
exports.toBeCloseTo = toBeCloseTo;
exports.toBeDefined = toBeDefined;
exports.toBeUndefined = toBeUndefined;
exports.toBeFalsy = toBeFalsy;
exports.toBeTruthy = toBeTruthy;
exports.toBeGreaterThanOrEqual = toBeGreaterThanOrEqual;
exports.toBeGreaterThan = toBeGreaterThan;
exports.toBeInstanceOf = toBeInstanceOf;
exports.toBeLessThanOrEqual = toBeLessThanOrEqual;
exports.toBeLessThan = toBeLessThan;
exports.toBeNaN = toBeNaN;
exports.toBeNull = toBeNull;
exports.toHaveLength = toHaveLength;
exports.toHaveProperty = toHaveProperty;
exports.toContain = toContain;
exports.toContainEqual = toContainEqual;
exports.toMatch = toMatch;
exports.toMatchObject = toMatchObject;
exports.toHaveBeenCalled = toHaveBeenCalled;
exports.toHaveBeenCalledTimes = toHaveBeenCalledTimes;
exports.toHaveBeenCalledWith = toHaveBeenCalledWith;
exports.toHaveBeenLastCalledWith = toHaveBeenLastCalledWith;
exports.toHaveBeenNthCalledWith = toHaveBeenNthCalledWith;
exports.toHaveReturned = toHaveReturned;
exports.toHaveReturnedTimes = toHaveReturnedTimes;
exports.toHaveReturnedWith = toHaveReturnedWith;
exports.toHaveLastReturnedWith = toHaveLastReturnedWith;
exports.toHaveNthReturnedWith = toHaveNthReturnedWith;
exports.toThrow = toThrow;
const not_strict_equals_js_1 = require("../../assert/1.0.11/not_strict_equals.js");
const strict_equals_js_1 = require("../../assert/1.0.11/strict_equals.js");
const instance_of_js_1 = require("../../assert/1.0.11/instance_of.js");
const _assert_is_error_js_1 = require("./_assert_is_error.js");
const not_instance_of_js_1 = require("../../assert/1.0.11/not_instance_of.js");
const match_js_1 = require("../../assert/1.0.11/match.js");
const not_match_js_1 = require("../../assert/1.0.11/not_match.js");
const assertion_error_js_1 = require("../../assert/1.0.11/assertion_error.js");
const _assert_equals_js_1 = require("./_assert_equals.js");
const _assert_not_equals_js_1 = require("./_assert_not_equals.js");
const _equal_js_1 = require("./_equal.js");
const format_js_1 = require("../../internal/1.0.5/format.js");
const _mock_util_js_1 = require("./_mock_util.js");
const _inspect_args_js_1 = require("./_inspect_args.js");
const _utils_js_1 = require("./_utils.js");
function toBe(context, expect) {
    if (context.isNot) {
        (0, not_strict_equals_js_1.assertNotStrictEquals)(context.value, expect, context.customMessage);
    }
    else {
        (0, strict_equals_js_1.assertStrictEquals)(context.value, expect, context.customMessage);
    }
}
function toEqual(context, expected) {
    const v = context.value;
    const e = expected;
    const equalsOptions = (0, _utils_js_1.buildEqualOptions)({
        ...context,
        customTesters: [
            ...context.customTesters,
            _utils_js_1.iterableEquality,
        ],
    });
    if (context.isNot) {
        (0, _assert_not_equals_js_1.assertNotEquals)(v, e, equalsOptions);
    }
    else {
        (0, _assert_equals_js_1.assertEquals)(v, e, equalsOptions);
    }
}
function toStrictEqual(context, expected) {
    const equalsOptions = (0, _utils_js_1.buildEqualOptions)({
        ...context,
        strictCheck: true,
        customTesters: [
            ...context.customTesters,
            _utils_js_1.iterableEquality,
        ],
    });
    if (context.isNot) {
        (0, _assert_not_equals_js_1.assertNotEquals)(context.value, expected, equalsOptions);
    }
    else {
        (0, _assert_equals_js_1.assertEquals)(context.value, expected, equalsOptions);
    }
}
function toBeCloseTo(context, expected, numDigits = 2) {
    if (numDigits < 0) {
        throw new Error("toBeCloseTo second argument must be a non-negative integer. Got " +
            numDigits);
    }
    const tolerance = 0.5 * Math.pow(10, -numDigits);
    const value = Number(context.value);
    const pass = Math.abs(expected - value) < tolerance;
    if (context.isNot) {
        if (pass) {
            const defaultMessage = `Expected the value ${value} not to be close to ${expected} (using ${numDigits} digits), but it is`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!pass) {
            const defaultMessage = `Expected the value ${value} to be close to ${expected} (using ${numDigits} digits), but it is not`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toBeDefined(context) {
    if (context.isNot) {
        (0, strict_equals_js_1.assertStrictEquals)(context.value, undefined, context.customMessage);
    }
    else {
        (0, not_strict_equals_js_1.assertNotStrictEquals)(context.value, undefined, context.customMessage);
    }
}
function toBeUndefined(context) {
    if (context.isNot) {
        (0, not_strict_equals_js_1.assertNotStrictEquals)(context.value, undefined, context.customMessage);
    }
    else {
        (0, strict_equals_js_1.assertStrictEquals)(context.value, undefined, context.customMessage);
    }
}
function toBeFalsy(context) {
    const isFalsy = !(context.value);
    if (context.isNot) {
        if (isFalsy) {
            const defaultMessage = `Expected ${context.value} to NOT be falsy`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!isFalsy) {
            const defaultMessage = `Expected ${context.value} to be falsy`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toBeTruthy(context) {
    const isTruthy = !!(context.value);
    if (context.isNot) {
        if (isTruthy) {
            const defaultMessage = `Expected ${context.value} to NOT be truthy`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!isTruthy) {
            const defaultMessage = `Expected ${context.value} to be truthy`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toBeGreaterThanOrEqual(context, expected) {
    const isGreaterOrEqual = Number(context.value) >= Number(expected);
    if (context.isNot) {
        if (isGreaterOrEqual) {
            const defaultMessage = `Expected ${context.value} to NOT be greater than or equal ${expected}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!isGreaterOrEqual) {
            const defaultMessage = `Expected ${context.value} to be greater than or equal ${expected}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toBeGreaterThan(context, expected) {
    const isGreater = Number(context.value) > Number(expected);
    if (context.isNot) {
        if (isGreater) {
            const defaultMessage = `Expected ${context.value} to NOT be greater than ${expected}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!isGreater) {
            const defaultMessage = `Expected ${context.value} to be greater than ${expected}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toBeInstanceOf(context, expected) {
    if (context.isNot) {
        (0, not_instance_of_js_1.assertNotInstanceOf)(context.value, expected);
    }
    else {
        (0, instance_of_js_1.assertInstanceOf)(context.value, expected);
    }
}
function toBeLessThanOrEqual(context, expected) {
    const isLower = Number(context.value) <= Number(expected);
    if (context.isNot) {
        if (isLower) {
            const defaultMessage = `Expected ${context.value} to NOT be lower than or equal ${expected}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!isLower) {
            const defaultMessage = `Expected ${context.value} to be lower than or equal ${expected}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toBeLessThan(context, expected) {
    const isLower = Number(context.value) < Number(expected);
    if (context.isNot) {
        if (isLower) {
            const defaultMessage = `Expected ${context.value} to NOT be lower than ${expected}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!isLower) {
            const defaultMessage = `Expected ${context.value} to be lower than ${expected}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toBeNaN(context) {
    const equalsOptions = (0, _utils_js_1.buildEqualOptions)(context);
    if (context.isNot) {
        (0, _assert_not_equals_js_1.assertNotEquals)(isNaN(Number(context.value)), true, {
            ...equalsOptions,
            msg: equalsOptions.msg || `Expected ${context.value} to not be NaN`,
        });
    }
    else {
        (0, _assert_equals_js_1.assertEquals)(isNaN(Number(context.value)), true, {
            ...equalsOptions,
            msg: equalsOptions.msg || `Expected ${context.value} to be NaN`,
        });
    }
}
function toBeNull(context) {
    if (context.isNot) {
        (0, not_strict_equals_js_1.assertNotStrictEquals)(context.value, null, context.customMessage || `Expected ${context.value} to not be null`);
    }
    else {
        (0, strict_equals_js_1.assertStrictEquals)(context.value, null, context.customMessage || `Expected ${context.value} to be null`);
    }
}
function toHaveLength(context, expected) {
    const { value } = context;
    // deno-lint-ignore no-explicit-any
    const maybeLength = value?.length;
    const hasLength = maybeLength === expected;
    if (context.isNot) {
        if (hasLength) {
            const defaultMessage = `Expected value not to have length ${expected}, but it does`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!hasLength) {
            const defaultMessage = `Expected value to have length ${expected}, but it does not: the value has length ${maybeLength}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toHaveProperty(context, propName, v) {
    const { value } = context;
    let propPath = [];
    if (Array.isArray(propName)) {
        propPath = propName;
    }
    else {
        propPath = propName.split(".");
    }
    // deno-lint-ignore no-explicit-any
    let current = value;
    while (true) {
        if (current === undefined || current === null) {
            break;
        }
        if (propPath.length === 0) {
            break;
        }
        const prop = propPath.shift();
        current = current[prop];
    }
    let hasProperty;
    if (v) {
        hasProperty = current !== undefined && propPath.length === 0 &&
            (0, _equal_js_1.equal)(current, v, context);
    }
    else {
        hasProperty = current !== undefined && propPath.length === 0;
    }
    let ofValue = "";
    if (v) {
        ofValue = ` of the value ${(0, _inspect_args_js_1.inspectArg)(v)}`;
    }
    if (context.isNot) {
        if (hasProperty) {
            const defaultMessage = `Expected the value not to have the property ${propPath.join(".")}${ofValue}, but it does`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!hasProperty) {
            const defaultMessage = `Expected the value to have the property ${propPath.join(".")}${ofValue}, but it does not`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toContain(context, expected) {
    // deno-lint-ignore no-explicit-any
    const doesContain = context.value?.includes?.(expected);
    const fmtValue = (0, format_js_1.format)(context.value);
    const fmtExpected = (0, format_js_1.format)(expected);
    if (context.isNot) {
        if (doesContain) {
            const defaultMessage = `The value ${fmtValue} contains the expected item ${fmtExpected}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!doesContain) {
            const defaultMessage = `The value ${fmtValue} doesn't contain the expected item ${fmtExpected}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toContainEqual(context, expected) {
    const { value } = context;
    assertIsIterable(value);
    let doesContain = false;
    for (const item of value) {
        if ((0, _equal_js_1.equal)(item, expected, context)) {
            doesContain = true;
            break;
        }
    }
    const prettyStringify = (js) => JSON.stringify(js, null, "\t")
        .replace(/\"|\n|\t/g, "")
        .slice(0, 100);
    const fmtValue = prettyStringify(context.value);
    const fmtExpected = prettyStringify(expected);
    if (context.isNot) {
        if (doesContain) {
            const defaultMessage = `The value contains the expected item:
Value: ${fmtValue}
Expected: ${fmtExpected}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!doesContain) {
            const defaultMessage = `The value doesn't contain the expected item:
Value: ${fmtValue}
Expected: ${fmtExpected}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
// deno-lint-ignore no-explicit-any
function assertIsIterable(value) {
    if (value == null) {
        throw new assertion_error_js_1.AssertionError("The value is null or undefined");
    }
    if (typeof value[Symbol.iterator] !== "function") {
        throw new assertion_error_js_1.AssertionError("The value is not iterable");
    }
}
function toMatch(context, expected) {
    if (context.isNot) {
        (0, not_match_js_1.assertNotMatch)(String(context.value), expected, context.customMessage);
    }
    else {
        (0, match_js_1.assertMatch)(String(context.value), expected, context.customMessage);
    }
}
function toMatchObject(context, expected) {
    const received = context.value;
    const defaultMsg = "Received value must be an object";
    if (typeof received !== "object" || received === null) {
        throw new assertion_error_js_1.AssertionError(context.customMessage
            ? `${context.customMessage}: ${defaultMsg}`
            : defaultMsg);
    }
    if (typeof expected !== "object" || expected === null) {
        throw new assertion_error_js_1.AssertionError(context.customMessage
            ? `${context.customMessage}: ${defaultMsg}`
            : defaultMsg);
    }
    const pass = (0, _equal_js_1.equal)(context.value, expected, {
        strictCheck: false,
        customTesters: [
            ...context.customTesters,
            _utils_js_1.iterableEquality,
            _utils_js_1.subsetEquality,
        ],
    });
    const triggerError = () => {
        const actualString = (0, format_js_1.format)(context.value);
        const expectedString = (0, format_js_1.format)(expected);
        if (context.isNot) {
            const defaultMessage = `Expected ${actualString} to NOT match ${expectedString}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
        else {
            const defaultMessage = `Expected ${actualString} to match ${expectedString}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    };
    if (context.isNot && pass || !context.isNot && !pass) {
        triggerError();
    }
}
function toHaveBeenCalled(context) {
    const calls = (0, _mock_util_js_1.getMockCalls)(context.value);
    const hasBeenCalled = calls.length > 0;
    if (context.isNot) {
        if (hasBeenCalled) {
            const defaultMessage = `Expected mock function not to be called, but it was called ${calls.length} time(s)`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!hasBeenCalled) {
            const defaultMessage = "Expected mock function to be called, but it was not called";
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toHaveBeenCalledTimes(context, expected) {
    const calls = (0, _mock_util_js_1.getMockCalls)(context.value);
    if (context.isNot) {
        if (calls.length === expected) {
            const defaultMessage = `Expected mock function not to be called ${expected} time(s), but it was`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (calls.length !== expected) {
            const defaultMessage = `Expected mock function to be called ${expected} time(s), but it was called ${calls.length} time(s)`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toHaveBeenCalledWith(context, ...expected) {
    const calls = (0, _mock_util_js_1.getMockCalls)(context.value);
    const hasBeenCalled = calls.some((call) => (0, _equal_js_1.equal)(call.args, expected));
    if (context.isNot) {
        if (hasBeenCalled) {
            const defaultMessage = `Expected mock function not to be called with ${(0, _inspect_args_js_1.inspectArgs)(expected)}, but it was`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!hasBeenCalled) {
            let otherCalls = "";
            if (calls.length > 0) {
                otherCalls = `\n  Other calls:\n     ${calls.map((call) => (0, _inspect_args_js_1.inspectArgs)(call.args)).join("\n    ")}`;
            }
            const defaultMessage = `Expected mock function to be called with ${(0, _inspect_args_js_1.inspectArgs)(expected)}, but it was not.${otherCalls}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toHaveBeenLastCalledWith(context, ...expected) {
    const calls = (0, _mock_util_js_1.getMockCalls)(context.value);
    const hasBeenCalled = calls.length > 0 &&
        (0, _equal_js_1.equal)(calls.at(-1)?.args, expected);
    if (context.isNot) {
        if (hasBeenCalled) {
            const defaultMessage = `Expected mock function not to be last called with ${(0, _inspect_args_js_1.inspectArgs)(expected)}, but it was`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!hasBeenCalled) {
            const lastCall = calls.at(-1);
            if (!lastCall) {
                const defaultMessage = `Expected mock function to be last called with ${(0, _inspect_args_js_1.inspectArgs)(expected)}, but it was not`;
                throw new assertion_error_js_1.AssertionError(context.customMessage
                    ? `${context.customMessage}: ${defaultMessage}`
                    : defaultMessage);
            }
            else {
                const defaultMessage = `Expected mock function to be last called with ${(0, _inspect_args_js_1.inspectArgs)(expected)}, but it was last called with ${(0, _inspect_args_js_1.inspectArgs)(lastCall.args)}`;
                throw new assertion_error_js_1.AssertionError(context.customMessage
                    ? `${context.customMessage}: ${defaultMessage}`
                    : defaultMessage);
            }
        }
    }
}
function toHaveBeenNthCalledWith(context, nth, ...expected) {
    if (nth < 1) {
        throw new Error(`nth must be greater than 0: received ${nth}`);
    }
    const calls = (0, _mock_util_js_1.getMockCalls)(context.value);
    const callIndex = nth - 1;
    const hasBeenCalled = calls.length > callIndex &&
        (0, _equal_js_1.equal)(calls[callIndex]?.args, expected);
    if (context.isNot) {
        if (hasBeenCalled) {
            const defaultMessage = `Expected the n-th call (n=${nth}) of mock function is not with ${(0, _inspect_args_js_1.inspectArgs)(expected)}, but it was`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!hasBeenCalled) {
            const nthCall = calls[callIndex];
            if (!nthCall) {
                const defaultMessage = `Expected the n-th call (n=${nth}) of mock function is with ${(0, _inspect_args_js_1.inspectArgs)(expected)}, but the n-th call does not exist`;
                throw new assertion_error_js_1.AssertionError(context.customMessage
                    ? `${context.customMessage}: ${defaultMessage}`
                    : defaultMessage);
            }
            else {
                const defaultMessage = `Expected the n-th call (n=${nth}) of mock function is with ${(0, _inspect_args_js_1.inspectArgs)(expected)}, but it was with ${(0, _inspect_args_js_1.inspectArgs)(nthCall.args)}`;
                throw new assertion_error_js_1.AssertionError(context.customMessage
                    ? `${context.customMessage}: ${defaultMessage}`
                    : defaultMessage);
            }
        }
    }
}
function toHaveReturned(context) {
    const calls = (0, _mock_util_js_1.getMockCalls)(context.value);
    const returned = calls.filter((call) => call.returns);
    if (context.isNot) {
        if (returned.length > 0) {
            const defaultMessage = `Expected the mock function to not have returned, but it returned ${returned.length} times`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (returned.length === 0) {
            const defaultMessage = `Expected the mock function to have returned, but it did not return`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toHaveReturnedTimes(context, expected) {
    const calls = (0, _mock_util_js_1.getMockCalls)(context.value);
    const returned = calls.filter((call) => call.returns);
    if (context.isNot) {
        if (returned.length === expected) {
            const defaultMessage = `Expected the mock function to not have returned ${expected} times, but it returned ${returned.length} times`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (returned.length !== expected) {
            const defaultMessage = `Expected the mock function to have returned ${expected} times, but it returned ${returned.length} times`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toHaveReturnedWith(context, expected) {
    const calls = (0, _mock_util_js_1.getMockCalls)(context.value);
    const returned = calls.filter((call) => call.returns);
    const returnedWithExpected = returned.some((call) => (0, _equal_js_1.equal)(call.returned, expected));
    if (context.isNot) {
        if (returnedWithExpected) {
            const defaultMessage = `Expected the mock function to not have returned with ${(0, _inspect_args_js_1.inspectArg)(expected)}, but it did`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!returnedWithExpected) {
            const defaultMessage = `Expected the mock function to have returned with ${(0, _inspect_args_js_1.inspectArg)(expected)}, but it did not`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toHaveLastReturnedWith(context, expected) {
    const calls = (0, _mock_util_js_1.getMockCalls)(context.value);
    const returned = calls.filter((call) => call.returns);
    const lastReturnedWithExpected = returned.length > 0 &&
        (0, _equal_js_1.equal)(returned.at(-1)?.returned, expected);
    if (context.isNot) {
        if (lastReturnedWithExpected) {
            const defaultMessage = `Expected the mock function to not have last returned with ${(0, _inspect_args_js_1.inspectArg)(expected)}, but it did`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!lastReturnedWithExpected) {
            const defaultMessage = `Expected the mock function to have last returned with ${(0, _inspect_args_js_1.inspectArg)(expected)}, but it did not`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toHaveNthReturnedWith(context, nth, expected) {
    if (nth < 1) {
        throw new Error(`nth(${nth}) must be greater than 0`);
    }
    const calls = (0, _mock_util_js_1.getMockCalls)(context.value);
    const returned = calls.filter((call) => call.returns);
    const returnIndex = nth - 1;
    const maybeNthReturned = returned[returnIndex];
    const nthReturnedWithExpected = maybeNthReturned &&
        (0, _equal_js_1.equal)(maybeNthReturned.returned, expected);
    if (context.isNot) {
        if (nthReturnedWithExpected) {
            const defaultMessage = `Expected the mock function to not have n-th (n=${nth}) returned with ${(0, _inspect_args_js_1.inspectArg)(expected)}, but it did`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
    else {
        if (!nthReturnedWithExpected) {
            const defaultMessage = `Expected the mock function to have n-th (n=${nth}) returned with ${(0, _inspect_args_js_1.inspectArg)(expected)}, but it did not`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
    }
}
function toThrow(context, 
// deno-lint-ignore no-explicit-any
expected) {
    if (typeof context.value === "function") {
        try {
            context.value = context.value();
        }
        catch (err) {
            context.value = err;
        }
    }
    let expectClass = undefined;
    let expectMessage = undefined;
    if (expected instanceof Error) {
        expectClass = expected.constructor;
        expectMessage = expected.message;
    }
    if (expected instanceof Function) {
        expectClass = expected;
    }
    if (typeof expected === "string" || expected instanceof RegExp) {
        expectMessage = expected;
    }
    if (context.isNot) {
        let isError = false;
        try {
            (0, _assert_is_error_js_1.assertIsError)(context.value, expectClass, expectMessage, context.customMessage);
            isError = true;
            const defaultMessage = `Expected to NOT throw ${expected}`;
            throw new assertion_error_js_1.AssertionError(context.customMessage
                ? `${context.customMessage}: ${defaultMessage}`
                : defaultMessage);
        }
        catch (e) {
            if (isError) {
                throw e;
            }
            return;
        }
    }
    return (0, _assert_is_error_js_1.assertIsError)(context.value, expectClass, expectMessage, context.customMessage);
}
