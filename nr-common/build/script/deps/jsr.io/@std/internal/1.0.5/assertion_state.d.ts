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
export declare class AssertionState {
    #private;
    constructor();
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
    get assertionCount(): number | undefined;
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
    get assertionTriggeredCount(): number;
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
    setAssertionCheck(val: boolean): void;
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
    setAssertionTriggered(val: boolean): void;
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
    setAssertionCount(num: number): void;
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
    updateAssertionTriggerCount(): void;
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
    checkAssertionErrorState(): boolean;
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
    resetAssertionState(): void;
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
    checkAssertionCountSatisfied(): boolean;
}
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
export declare function getAssertionState(): AssertionState;
//# sourceMappingURL=assertion_state.d.ts.map