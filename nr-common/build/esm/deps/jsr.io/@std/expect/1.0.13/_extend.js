// Copyright 2018-2025 the Deno authors. MIT license.
let extendMatchers = {};
export function getExtendMatchers() {
    return extendMatchers;
}
export function setExtendMatchers(newExtendMatchers) {
    extendMatchers = {
        ...extendMatchers,
        ...newExtendMatchers,
    };
}
