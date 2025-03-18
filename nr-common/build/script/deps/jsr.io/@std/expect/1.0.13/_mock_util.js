"use strict";
// Copyright 2018-2025 the Deno authors. MIT license.
// deno-lint-ignore-file no-explicit-any
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOCK_SYMBOL = void 0;
exports.getMockCalls = getMockCalls;
exports.MOCK_SYMBOL = Symbol.for("@MOCK");
function getMockCalls(f) {
    const mockInfo = f[exports.MOCK_SYMBOL];
    if (!mockInfo) {
        throw new Error("Received function must be a mock or spy function");
    }
    return [...mockInfo.calls];
}
