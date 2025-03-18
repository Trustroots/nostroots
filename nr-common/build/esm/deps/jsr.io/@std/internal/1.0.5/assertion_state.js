// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _AssertionState_state;
/**
 * Check the test suite internal state
 *
 * @example Usage
 * ```ts ignore
 * import { AssertionState } from "@std/internal";
 *
 * const assertionState = new AssertionState();
 * ```
 */
export class AssertionState {
    constructor() {
        _AssertionState_state.set(this, void 0);
        __classPrivateFieldSet(this, _AssertionState_state, {
            assertionCount: undefined,
            assertionCheck: false,
            assertionTriggered: false,
            assertionTriggeredCount: 0,
        }, "f");
    }
    /**
     * Get the number that through `expect.assertions` api set.
     *
     * @returns the number that through `expect.assertions` api set.
     *
     * @example Usage
     * ```ts ignore
     * import { AssertionState } from "@std/internal";
     *
     * const assertionState = new AssertionState();
     * assertionState.assertionCount;
     * ```
     */
    get assertionCount() {
        return __classPrivateFieldGet(this, _AssertionState_state, "f").assertionCount;
    }
    /**
     * Get a certain number that assertions were called before.
     *
     * @returns return a certain number that assertions were called before.
     *
     * @example Usage
     * ```ts ignore
     * import { AssertionState } from "@std/internal";
     *
     * const assertionState = new AssertionState();
     * assertionState.assertionTriggeredCount;
     * ```
     */
    get assertionTriggeredCount() {
        return __classPrivateFieldGet(this, _AssertionState_state, "f").assertionTriggeredCount;
    }
    /**
     * If `expect.hasAssertions` called, then through this method to update #state.assertionCheck value.
     *
     * @param val Set #state.assertionCheck's value
     *
     * @example Usage
     * ```ts ignore
     * import { AssertionState } from "@std/internal";
     *
     * const assertionState = new AssertionState();
     * assertionState.setAssertionCheck(true);
     * ```
     */
    setAssertionCheck(val) {
        __classPrivateFieldGet(this, _AssertionState_state, "f").assertionCheck = val;
    }
    /**
     * If any matchers was called, `#state.assertionTriggered` will be set through this method.
     *
     * @param val Set #state.assertionTriggered's value
     *
     * @example Usage
     * ```ts ignore
     * import { AssertionState } from "@std/internal";
     *
     * const assertionState = new AssertionState();
     * assertionState.setAssertionTriggered(true);
     * ```
     */
    setAssertionTriggered(val) {
        __classPrivateFieldGet(this, _AssertionState_state, "f").assertionTriggered = val;
    }
    /**
     * If `expect.assertions` called, then through this method to update #state.assertionCheck value.
     *
     * @param num Set #state.assertionCount's value, for example if the value is set 2, that means
     * you must have two assertion matchers call in your test suite.
     *
     * @example Usage
     * ```ts ignore
     * import { AssertionState } from "@std/internal";
     *
     * const assertionState = new AssertionState();
     * assertionState.setAssertionCount(2);
     * ```
     */
    setAssertionCount(num) {
        __classPrivateFieldGet(this, _AssertionState_state, "f").assertionCount = num;
    }
    /**
     * If any matchers was called, `#state.assertionTriggeredCount` value will plus one internally.
     *
     * @example Usage
     * ```ts ignore
     * import { AssertionState } from "@std/internal";
     *
     * const assertionState = new AssertionState();
     * assertionState.updateAssertionTriggerCount();
     * ```
     */
    updateAssertionTriggerCount() {
        if (__classPrivateFieldGet(this, _AssertionState_state, "f").assertionCount !== undefined) {
            __classPrivateFieldGet(this, _AssertionState_state, "f").assertionTriggeredCount += 1;
        }
    }
    /**
     * Check Assertion internal state, if `#state.assertionCheck` is set true, but
     * `#state.assertionTriggered` is still false, then should throw an Assertion Error.
     *
     * @returns a boolean value, that the test suite is satisfied with the check. If not,
     * it should throw an AssertionError.
     *
     * @example Usage
     * ```ts ignore
     * import { AssertionState } from "@std/internal";
     *
     * const assertionState = new AssertionState();
     * if (assertionState.checkAssertionErrorState()) {
     *   // throw AssertionError("");
     * }
     * ```
     */
    checkAssertionErrorState() {
        return __classPrivateFieldGet(this, _AssertionState_state, "f").assertionCheck && !__classPrivateFieldGet(this, _AssertionState_state, "f").assertionTriggered;
    }
    /**
     * Reset all assertion state when every test suite function ran completely.
     *
     * @example Usage
     * ```ts ignore
     * import { AssertionState } from "@std/internal";
     *
     * const assertionState = new AssertionState();
     * assertionState.resetAssertionState();
     * ```
     */
    resetAssertionState() {
        __classPrivateFieldSet(this, _AssertionState_state, {
            assertionCount: undefined,
            assertionCheck: false,
            assertionTriggered: false,
            assertionTriggeredCount: 0,
        }, "f");
    }
    /**
     * Check Assertion called state, if `#state.assertionCount` is set to a number value, but
     * `#state.assertionTriggeredCount` is less then it, then should throw an assertion error.
     *
     * @returns a boolean value, that the test suite is satisfied with the check. If not,
     * it should throw an AssertionError.
     *
     * @example Usage
     * ```ts ignore
     * import { AssertionState } from "@std/internal";
     *
     * const assertionState = new AssertionState();
     * if (assertionState.checkAssertionCountSatisfied()) {
     *   // throw AssertionError("");
     * }
     * ```
     */
    checkAssertionCountSatisfied() {
        return __classPrivateFieldGet(this, _AssertionState_state, "f").assertionCount !== undefined &&
            __classPrivateFieldGet(this, _AssertionState_state, "f").assertionCount !== __classPrivateFieldGet(this, _AssertionState_state, "f").assertionTriggeredCount;
    }
}
_AssertionState_state = new WeakMap();
const assertionState = new AssertionState();
/**
 * return an instance of AssertionState
 *
 * @returns AssertionState
 *
 * @example Usage
 * ```ts ignore
 * import { getAssertionState } from "@std/internal";
 *
 * const assertionState = getAssertionState();
 * assertionState.setAssertionTriggered(true);
 * ```
 */
export function getAssertionState() {
    return assertionState;
}
