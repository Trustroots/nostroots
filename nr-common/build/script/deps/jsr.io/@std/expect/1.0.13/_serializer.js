"use strict";
// Copyright 2018-2025 the Deno authors. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSerializer = addSerializer;
exports.getSerializer = getSerializer;
const INTERNAL_PLUGINS = [
// TODO(eryue0220): support internal snapshot serializer plugins
];
function addSerializer(plugin) {
    INTERNAL_PLUGINS.unshift(plugin);
}
function getSerializer() {
    return INTERNAL_PLUGINS;
}
