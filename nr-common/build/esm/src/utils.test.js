import "../_dnt.test_polyfills.js";
import * as dntShim from "../_dnt.test_shims.js";
import { expect } from "../deps/jsr.io/@std/expect/1.0.13/mod.js";
import { isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue, isValidTagsArrayWithTrustrootsUsername, } from "./utils.js";
dntShim.Deno.test("#QX3iok Tags with namespace and no value returns false", () => {
    const tags = [
        ["L", "open-location-code"],
        ["L", "foo"],
        ["l", "bar", "foo"],
    ];
    expect(isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue(tags)).toBe(false);
});
dntShim.Deno.test("#QkbuAn Tags with namespace and value returns true", () => {
    const tags = [
        ["L", "open-location-code"],
        ["l", "CC000000+", "open-location-code"],
        ["L", "foo"],
        ["l", "bar", "foo"],
    ];
    expect(isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue(tags)).toBe(true);
});
dntShim.Deno.test("#qdp7pp Tags with two char username returns false", () => {
    const tags = [
        ["L", "open-location-code"],
        ["l", "CC000000+", "open-location-code"],
        ["L", "org.trustroots:username"],
        ["l", "ab", "org.trustroots:username"],
    ];
    expect(isValidTagsArrayWithTrustrootsUsername(tags)).toBe(false);
});
dntShim.Deno.test("#6kqkIj Tags with four char username returns true", () => {
    const tags = [
        ["L", "open-location-code"],
        ["l", "CC000000+", "open-location-code"],
        ["L", "org.trustroots:username"],
        ["l", "abcd", "org.trustroots:username"],
    ];
    expect(isValidTagsArrayWithTrustrootsUsername(tags)).toBe(true);
});
dntShim.Deno.test("#v91hjr Tags with username namespace and no value returns false", () => {
    const tags = [
        ["L", "foo"],
        ["l", "bar", "foo"],
        ["L", "org.trustroots:username"],
    ];
    expect(isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue(tags)).toBe(false);
});
