import { Event } from "@common/mod";

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
