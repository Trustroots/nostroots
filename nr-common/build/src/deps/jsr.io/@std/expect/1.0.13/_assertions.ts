// Copyright 2018-2025 the Deno authors. MIT license.

import { getAssertionState } from "../../internal/1.0.5/assertion_state.js";

const assertionState = getAssertionState();

export function hasAssertions() {
  assertionState.setAssertionCheck(true);
}

export function assertions(num: number) {
  assertionState.setAssertionCount(num);
}

export function emitAssertionTrigger() {
  assertionState.setAssertionTriggered(true);
  assertionState.updateAssertionTriggerCount();
}
