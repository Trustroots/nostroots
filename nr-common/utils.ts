import {
  DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH,
  OPEN_LOCATION_CODE_PREFIX_TAG_NAME,
  OPEN_LOCATION_CODE_TAG_NAME,
} from "./constants.ts";
import type { Event } from "./mod.ts";


function last<T>(items: T[]): T {
  const lastIndex = Math.max(items.length - 1, 0);
  return items[lastIndex];
}

export function isHex(s: string): boolean {
  return s.split("").every((c) => "0123456789abcdef".split("").includes(c));
}

export function isHexKey(key: string): boolean {
  if (!isHex(key)) {
    return false;
  }
  if (key.length !== 64) {
    return false;
  }
  return true;
}

export function isPlusCode(code: string) {
  return true;
  // todo: use OpenLocationCode.isValid instead
  // https://github.com/tspoke/typescript-open-location-code/blob/f44c7dd208fc65a903f4ab28381f0b4b59faac47/src/open-location-code.ts#L137

  const re =
    /(^|\s)([23456789C][23456789CFGHJMPQRV][23456789CFGHJMPQRVWX]{6}\+[23456789CFGHJMPQRVWX]{2,7})(\s|$)/i;
  return re.test(code);
}

export function getCurrentTimestamp() {
  return Math.round(Date.now() / 1e3);
}

export function getFirstTagValueFromEvent(
  nostrEvent: Event,
  tagName: string
): string | undefined {
  const firstMatchingTagPair = nostrEvent.tags.find(([key]) => key === tagName);

  if (typeof firstMatchingTagPair === "undefined") {
    return;
  }

  const [, firstValue] = firstMatchingTagPair;

  return firstValue;
}

export function getFirstLabelValueFromEvent(
  nostrEvent: Event,
  labelName: string
): string | undefined {
  const { tags } = nostrEvent;
  const matchingTag = tags.find(
    (tag) => tag[0] === "l" && last(tag) === labelName
  );
  if (typeof matchingTag === "undefined") {
    return;
  }
  const labelValue = matchingTag[1];
  return labelValue;
}

export function createLabelTags(
  labelName: string,
  labelValue: string | string[]
) {
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

export function getPlusCodePrefix(plusCode: string, length: number): string {
  const prefix = plusCode.substring(0, length);
  const paddedPrefix = prefix.padEnd(8, "0");
  const prefixPlusCode = `${paddedPrefix}+`;
  return prefixPlusCode;
}

export function getAllPlusCodePrefixes(
  plusCode: string,
  minimumLength: number
): string[] {
  if (minimumLength % 2 !== 0) {
    throw new Error("#HqXbxX-invalid-minimum-length");
  }
  const numberOfCodes = (8 - minimumLength) / 2 + 1;
  const plusCodes = Array.from({ length: numberOfCodes }, (_value, index) =>
    getPlusCodePrefix(plusCode, minimumLength + index * 2)
  );
  return plusCodes;
}

export function getPlusCodeAndPlusCodePrefixTags(plusCode: string) {
  const plusCodeTags = createLabelTags(OPEN_LOCATION_CODE_TAG_NAME, plusCode);
  const plusCodePrefixes = getAllPlusCodePrefixes(
    plusCode,
    DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH
  );
  const plusCodePrefixTags = createLabelTags(
    OPEN_LOCATION_CODE_PREFIX_TAG_NAME,
    plusCodePrefixes
  );
  const tags = [...plusCodeTags, ...plusCodePrefixTags];
  return tags;
}
