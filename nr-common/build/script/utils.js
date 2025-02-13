"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHex = isHex;
exports.isHexKey = isHexKey;
exports.isPlusCode = isPlusCode;
exports.isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue = isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue;
exports.isValidTagsArrayWithTrustrootsUsername = isValidTagsArrayWithTrustrootsUsername;
exports.getCurrentTimestamp = getCurrentTimestamp;
exports.getFirstTagValueFromEvent = getFirstTagValueFromEvent;
exports.getFirstLabelValueFromTags = getFirstLabelValueFromTags;
exports.createLabelTags = createLabelTags;
exports.getFirstLabelValueFromEvent = getFirstLabelValueFromEvent;
exports.getPlusCodePrefix = getPlusCodePrefix;
exports.getAllPlusCodePrefixes = getAllPlusCodePrefixes;
exports.getPlusCodeAndPlusCodePrefixTags = getPlusCodeAndPlusCodePrefixTags;
const constants_js_1 = require("./constants.js");
function last(items) {
    const lastIndex = Math.max(items.length - 1, 0);
    return items[lastIndex];
}
function unique(items) {
    const dedupedItems = items.filter((item, index) => items.indexOf(item) === index);
    return dedupedItems;
}
function isHex(s) {
    return s.split("").every((c) => "0123456789abcdef".split("").includes(c));
}
function isHexKey(key) {
    if (!isHex(key)) {
        return false;
    }
    if (key.length !== 64) {
        return false;
    }
    return true;
}
function isPlusCode(code) {
    // Test against a regex that does a reasonable job of finding bad values
    const re = /(^|\s)([23456789C][23456789CFGHJMPQRV][023456789CFGHJMPQRVWX]{6}\+[23456789CFGHJMPQRVWX]*)(\s|$)/i;
    const simpleTestResult = re.test(code);
    if (simpleTestResult === false) {
        return false;
    }
    // Don't allow just 1 trailing character after the plus
    if (code.length > 9) {
        const [, trailing] = code.split("+");
        if (trailing.length === 1) {
            return false;
        }
    }
    // Check if any characters follow a zero like `AA00AA00+` is invalid
    const { failed } = code.split("").reduce(({ failed, zeroSeen }, letter) => {
        if (failed || letter === "+") {
            return { failed, zeroSeen };
        }
        if (letter === "0") {
            return { failed, zeroSeen: true };
        }
        else {
            if (zeroSeen) {
                return { failed: true, zeroSeen };
            }
            else {
                return { failed, zeroSeen };
            }
        }
    }, { failed: false, zeroSeen: false });
    if (failed) {
        return false;
    }
    return true;
}
function isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue(tags) {
    const labelNamespaceTags = tags.filter((tag) => tag[0] === "L");
    const allNamespacesHaveAtLeastOneTag = labelNamespaceTags.every((namespaceTag) => {
        const namespace = namespaceTag[1];
        const firstValue = getFirstLabelValueFromTags(tags, namespace);
        if (typeof firstValue !== "undefined") {
            return true;
        }
        return false;
    });
    return allNamespacesHaveAtLeastOneTag;
}
function isValidTagsArrayWithTrustrootsUsername(tags) {
    const trustrootsUsername = getFirstLabelValueFromTags(tags, constants_js_1.TRUSTROOTS_USERNAME_LABEL_NAMESPACE);
    if (typeof trustrootsUsername !== "string" ||
        trustrootsUsername.length <= constants_js_1.TRUSTROOTS_USERNAME_MIN_LENGTH) {
        return false;
    }
    return true;
}
function getCurrentTimestamp() {
    return Math.round(Date.now() / 1e3);
}
function getFirstTagValueFromEvent(nostrEvent, tagName) {
    const firstMatchingTagPair = nostrEvent.tags.find(([key]) => key === tagName);
    if (typeof firstMatchingTagPair === "undefined") {
        return;
    }
    const [, firstValue] = firstMatchingTagPair;
    return firstValue;
}
function getFirstLabelValueFromTags(tags, labelName) {
    const matchingTag = tags.find((tag) => tag[0] === "l" && last(tag) === labelName);
    if (typeof matchingTag === "undefined") {
        return;
    }
    const labelValue = matchingTag[1];
    return labelValue;
}
function createLabelTags(labelName, labelValue) {
    const tags = [
        ["L", labelName],
        [
            "l",
            ...(Array.isArray(labelValue) ? labelValue : [labelValue]),
            labelName,
        ],
    ];
    return tags;
}
function getFirstLabelValueFromEvent(nostrEvent, labelName) {
    return getFirstLabelValueFromTags(nostrEvent.tags, labelName);
}
function getPlusCodePrefix(plusCode, length) {
    const prefix = plusCode.substring(0, length);
    const paddedPrefix = prefix.padEnd(8, "0");
    const prefixPlusCode = `${paddedPrefix}+`;
    return prefixPlusCode;
}
// TODO This should accept a maximumLength as well
function getAllPlusCodePrefixes(plusCode, minimumLength) {
    if (minimumLength % 2 !== 0) {
        throw new Error("#HqXbxX-invalid-minimum-length");
    }
    const numberOfCodes = (8 - minimumLength) / 2 + 1;
    const plusCodes = Array.from({ length: numberOfCodes }, (_value, index) => getPlusCodePrefix(plusCode, minimumLength + index * 2));
    const uniquePlusCodePrefixes = unique(plusCodes);
    return uniquePlusCodePrefixes;
}
function getPlusCodeAndPlusCodePrefixTags(plusCode) {
    const plusCodeTags = createLabelTags(constants_js_1.OPEN_LOCATION_CODE_TAG_NAME, plusCode);
    const plusCodePrefixes = getAllPlusCodePrefixes(plusCode, constants_js_1.DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH);
    const plusCodePrefixTags = createLabelTags(constants_js_1.OPEN_LOCATION_CODE_PREFIX_TAG_NAME, plusCodePrefixes);
    const tags = [...plusCodeTags, ...plusCodePrefixTags];
    return tags;
}
