// Copyright 2018-2025 the Deno authors. MIT license.
// deno-lint-ignore-file no-explicit-any
export const MOCK_SYMBOL = Symbol.for("@MOCK");
export function getMockCalls(f) {
    const mockInfo = f[MOCK_SYMBOL];
    if (!mockInfo) {
        throw new Error("Received function must be a mock or spy function");
    }
    return [...mockInfo.calls];
}
