"use strict";
// Copyright 2018-2025 the Deno authors. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExtendMatchers = getExtendMatchers;
exports.setExtendMatchers = setExtendMatchers;
let extendMatchers = {};
function getExtendMatchers() {
    return extendMatchers;
}
function setExtendMatchers(newExtendMatchers) {
    extendMatchers = {
        ...extendMatchers,
        ...newExtendMatchers,
    };
}
