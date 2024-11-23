import { Event } from "@common/mod";
import { A } from "@mobily/ts-belt";
import { Filter } from "nostr-tools";
import { MapLayer, NOSTROOTS_VALIDATION_PUBKEY } from "./constants";

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

export function getCurrentTimestamp() {
  return Math.round(Date.now() / 1e3);
}

export function getFirstTagValueFromEvent(
  nostrEvent: Event,
  tagName: string,
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
  labelName: string,
): string | undefined {
  const { tags } = nostrEvent;
  const matchingTag = tags.find(
    (tag) => tag[0] === "l" && A.last(tag) === labelName,
  );
  if (typeof matchingTag === "undefined") {
    return;
  }
  const labelValue = matchingTag[1];
  return labelValue;
}

export function trustrootsMapFilter(): Filter {
  const filter = {
    kinds: [30398],
    authors: [NOSTROOTS_VALIDATION_PUBKEY],
  };

  return filter;
}

export function openLocationCodePrefixFilter(
  plusCodePrefixes: string[],
): Filter {
  const filter = {
    "#L": ["open-location-code-prefix"],
    "#l": plusCodePrefixes,
  };

  return filter;
}

export function addOpenLocationCodePrefixToFilter(
  filter: Filter,
  plusCodePrefixes: string[],
): Filter {
  const plusCodeFilter = openLocationCodePrefixFilter(plusCodePrefixes);
  const combinedFilter = { ...filter, ...plusCodeFilter };
  return combinedFilter;
}

export function trustrootsMapFilterForPlusCodePrefixes(
  plusCodePrefixes: string[],
): Filter {
  const baseFilter = trustrootsMapFilter();
  const filter = addOpenLocationCodePrefixToFilter(
    baseFilter,
    plusCodePrefixes,
  );
  return filter;
}

export function filterForMapLayerConfig(layerConfig: MapLayer): Filter {
  const filter: Filter = {
    authors: [layerConfig.pubkey],
    kinds: [layerConfig.kind],
  };
  return filter;
}

export function filterForMapLayerConfigForPlusCodePrefixes(
  layerConfig: MapLayer,
  plusCodePrefixes: string[],
): Filter {
  const baseFilter = filterForMapLayerConfig(layerConfig);
  const filter = addOpenLocationCodePrefixToFilter(
    baseFilter,
    plusCodePrefixes,
  );
  return filter;
}

export function makeLabelTags(
  labelName: string,
  labelValue: string | string[],
) {
  const tags = [
    ["L", labelName],
    ["l", ...labelValue, labelName],
  ];
  return tags;
}
