"use strict";
// Copyright 2018-2025 the Deno authors. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCustomEqualityTesters = addCustomEqualityTesters;
exports.getCustomEqualityTesters = getCustomEqualityTesters;
const customEqualityTesters = [];
function addCustomEqualityTesters(newTesters) {
    if (!Array.isArray(newTesters)) {
        throw new TypeError(`customEqualityTester expects an array of Testers. But got ${typeof newTesters}`);
    }
    customEqualityTesters.push(...newTesters);
}
function getCustomEqualityTesters() {
    return customEqualityTesters;
}
