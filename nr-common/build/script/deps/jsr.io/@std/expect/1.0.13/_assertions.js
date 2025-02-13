"use strict";
// Copyright 2018-2025 the Deno authors. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasAssertions = hasAssertions;
exports.assertions = assertions;
exports.emitAssertionTrigger = emitAssertionTrigger;
const assertion_state_js_1 = require("../../internal/1.0.5/assertion_state.js");
const assertionState = (0, assertion_state_js_1.getAssertionState)();
function hasAssertions() {
    assertionState.setAssertionCheck(true);
}
function assertions(num) {
    assertionState.setAssertionCount(num);
}
function emitAssertionTrigger() {
    assertionState.setAssertionTriggered(true);
    assertionState.updateAssertionTriggerCount();
}
