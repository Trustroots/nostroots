import { DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH, OPEN_LOCATION_CODE_PREFIX_TAG_NAME, OPEN_LOCATION_CODE_TAG_NAME, PACKAGE_VERSION, TRUSTROOTS_USERNAME_LABEL_NAMESPACE, TRUSTROOTS_USERNAME_MIN_LENGTH, } from "../constants.js";
function last(items) {
    const lastIndex = Math.max(items.length - 1, 0);
    return items[lastIndex];
}
function unique(items) {
    const dedupedItems = items.filter((item, index) => items.indexOf(item) === index);
    return dedupedItems;
}
export function isHex(s) {
    return s.split("").every((c) => "0123456789abcdef".split("").includes(c));
}
export function isHexKey(key) {
    if (!isHex(key)) {
        return false;
    }
    if (key.length !== 64) {
        return false;
    }
    return true;
}
export function isPlusCode(code) {
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
export function isPlusCodeInsidePlusCode(containingPlusCode, targetPlusCode) {
    const indexOfFirstZero = containingPlusCode.indexOf("0");
    // If the plus code has a trailing zero, use the code up to that as a search
    // prefix, otherwise use the whole code
    const startsWithPrefix = indexOfFirstZero === -1
        ? containingPlusCode
        : containingPlusCode.slice(0, indexOfFirstZero);
    const isWithin = targetPlusCode.startsWith(startsWithPrefix);
    return isWithin;
}
export function isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue(tags) {
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
export function isValidTagsArrayWithTrustrootsUsername(tags) {
    const trustrootsUsername = getFirstLabelValueFromTags(tags, TRUSTROOTS_USERNAME_LABEL_NAMESPACE);
    if (typeof trustrootsUsername !== "string" ||
        trustrootsUsername.length <= TRUSTROOTS_USERNAME_MIN_LENGTH) {
        return false;
    }
    return true;
}
export function getCurrentTimestamp() {
    return Math.round(Date.now() / 1e3);
}
export function getFirstTagValueFromEvent(nostrEvent, tagName) {
    const firstMatchingTagPair = nostrEvent.tags.find(([key]) => key === tagName);
    if (typeof firstMatchingTagPair === "undefined") {
        return;
    }
    const [, firstValue] = firstMatchingTagPair;
    return firstValue;
}
export function getAllLabelValuesFromTags(tags, labelName) {
    const matchingTag = tags.find((tag) => tag[0] === "l" && last(tag) === labelName);
    if (typeof matchingTag === "undefined") {
        return;
    }
    const labelValues = matchingTag.slice(1, -1);
    return labelValues;
}
export function getFirstLabelValueFromTags(tags, labelName) {
    const tagsValues = getAllLabelValuesFromTags(tags, labelName);
    if (typeof tagsValues === "undefined" || tagsValues.length === 0) {
        return;
    }
    return tagsValues[0];
}
export function createLabelTags(labelName, labelValue) {
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
export function getAllLabelValuesFromEvent(nostrEvent, labelName) {
    return getAllLabelValuesFromTags(nostrEvent.tags, labelName);
}
export function getFirstLabelValueFromEvent(nostrEvent, labelName) {
    return getFirstLabelValueFromTags(nostrEvent.tags, labelName);
}
export function getPlusCodePrefix(plusCode, length) {
    const prefix = plusCode.substring(0, length);
    const paddedPrefix = prefix.padEnd(8, "0");
    const prefixPlusCode = `${paddedPrefix}+`;
    return prefixPlusCode;
}
// TODO This should accept a maximumLength as well
export function getAllPlusCodePrefixes(plusCode, minimumLength) {
    if (minimumLength % 2 !== 0) {
        throw new Error("#HqXbxX-invalid-minimum-length");
    }
    const numberOfCodes = (8 - minimumLength) / 2 + 1;
    const plusCodes = Array.from({ length: numberOfCodes }, (_value, index) => getPlusCodePrefix(plusCode, minimumLength + index * 2));
    const uniquePlusCodePrefixes = unique(plusCodes);
    return uniquePlusCodePrefixes;
}
export function getPlusCodeAndPlusCodePrefixTags(plusCode) {
    const plusCodeTags = createLabelTags(OPEN_LOCATION_CODE_TAG_NAME, plusCode);
    const plusCodePrefixes = getAllPlusCodePrefixes(plusCode, DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH);
    const plusCodePrefixTags = createLabelTags(OPEN_LOCATION_CODE_PREFIX_TAG_NAME, plusCodePrefixes);
    const tags = [...plusCodeTags, ...plusCodePrefixTags];
    return tags;
}
export function hasOpenLocationCode(tags) {
    const namespaces = tags
        .filter((tag) => tag[0] === "L")
        .map((tag) => tag.slice(1))
        .flat();
    const hasOpenLocationCodeNamespace = namespaces.includes(OPEN_LOCATION_CODE_TAG_NAME);
    if (!hasOpenLocationCodeNamespace)
        return false;
    const plusCodeTags = tags.filter((tag) => tag.length > 3 && tag[0] === "l" && tag[2] === OPEN_LOCATION_CODE_TAG_NAME);
    if (plusCodeTags.length === 0)
        return false;
    const plusCodes = plusCodeTags.map((plusCodeTag) => plusCodeTag[1]);
    const validPlusCodes = plusCodes.every(isPlusCode);
    if (!validPlusCodes)
        return false;
    return true;
}
export function hasVersion(tags) {
    const versionTags = tags.filter((tag) => tag[0] === "kind30398_version");
    if (versionTags.length !== 1)
        return false;
    const versionTag = versionTags[0];
    if (versionTag.length !== 2)
        return false;
    const version = versionTag[1];
    if (version !== PACKAGE_VERSION)
        return false;
    return true;
}
export async function getNip5PubKey(trustrootsUsername) {
    try {
        const url = `https://www.trustroots.org/.well-known/nostr.json?name=${trustrootsUsername}`;
        const nip5Response = await fetch(url);
        const { names, error } = (await nip5Response.json());
        if (error) {
            console.warn(`NIP-5 error for ${trustrootsUsername}:`, error);
            return;
        }
        if (!names) {
            return;
        }
        const nip5PubKey = names[trustrootsUsername];
        return nip5PubKey;
    }
    catch (e) {
        console.warn(`Could not get nip5 key for ${trustrootsUsername}`, e);
        return;
    }
}
export function getTrustrootsUsernameFromProfileEvent(event) {
    const username = getFirstLabelValueFromEvent(event, TRUSTROOTS_USERNAME_LABEL_NAMESPACE);
    return username;
}
