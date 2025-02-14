// Copyright 2018-2025 the Deno authors. MIT license.
const INTERNAL_PLUGINS = [
// TODO(eryue0220): support internal snapshot serializer plugins
];
export function addSerializer(plugin) {
    INTERNAL_PLUGINS.unshift(plugin);
}
export function getSerializer() {
    return INTERNAL_PLUGINS;
}
