import { Event } from "@common/mod";
import * as R from "ramda";

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
    (tag) => tag[0] === "l" && R.last(tag) === labelName,
  );
  if (typeof matchingTag === "undefined") {
    return;
  }
  const labelValue = matchingTag[1];
  return labelValue;
}
