import { getCurrentIfDraft } from "@/common/utils";
import { NotificationSubscriptionFilter } from "@/redux/slices/notifications.slice";
import { F } from "@mobily/ts-belt";
import { Draft } from "@reduxjs/toolkit";
import {
  Filter,
  isPlusCodeInsidePlusCode,
  MAP_NOTE_REPOST_KIND,
  NOSTROOTS_VALIDATION_PUBKEY,
  OPEN_LOCATION_CODE_LABEL_NAMESPACE,
  PlusCode,
} from "@trustroots/nr-common";

export function removeFilterFromFiltersArray(
  filters: NotificationSubscriptionFilter[],
  targetFilter: NotificationSubscriptionFilter,
) {
  return filters.filter((existingFilterDraft) => {
    const unwrappedDraft = getCurrentIfDraft(existingFilterDraft);
    const isEqual = F.equals(unwrappedDraft, targetFilter);
    return !isEqual;
  });
}

export function addFilterToFiltersArray(
  filters: (
    | NotificationSubscriptionFilter
    | Draft<NotificationSubscriptionFilter>
  )[],
  newFilter: NotificationSubscriptionFilter,
) {
  const filterAlreadyExists = filters.some((existingFilterDraft) => {
    const unwrappedDraft = getCurrentIfDraft(existingFilterDraft);
    const isEqual = F.equals(unwrappedDraft, newFilter);
    return isEqual;
  });
  if (filterAlreadyExists) {
    return filters;
  }
  return filters.concat(newFilter);
}

export function filterForPlusCode(plusCode: PlusCode) {
  const filter: Filter = {
    kinds: [MAP_NOTE_REPOST_KIND],
    authors: [NOSTROOTS_VALIDATION_PUBKEY],
    "#L": [OPEN_LOCATION_CODE_LABEL_NAMESPACE],
    "#l": [plusCode],
  };
  return filter;
}

function hasLabelFilter(
  filter: Filter,
): filter is Filter & { ["#l"]: string[] } {
  const hasLabel = "#l" in filter;
  if (!hasLabel) {
    return false;
  }
  const labelValues = filter["#l"];
  if (!Array.isArray(labelValues)) {
    return false;
  }
  if (
    labelValues.every((label) => typeof label === "string" && label.length > 0)
  ) {
    return true;
  }
  return false;
}

export function doesFilterMatchPlusCodeExactly(
  filter: Filter,
  plusCode: PlusCode,
): boolean {
  if (!hasLabelFilter(filter)) {
    return false;
  }
  const labelValues = filter["#l"];
  const hasMatchForRequiredPlusCode = labelValues.includes(plusCode);
  return hasMatchForRequiredPlusCode;
}

export function doesFilterMatchParentPlusCode(
  filter: Filter,
  plusCode: PlusCode,
): boolean {
  if (!hasLabelFilter(filter)) {
    return false;
  }
  const labelValues = filter["#l"];
  const hasMatchingPlusCode = labelValues.some((label) =>
    isPlusCodeInsidePlusCode(label, plusCode),
  );
  return hasMatchingPlusCode;
}
