import {
  getCurrentTimestamp,
  getPlusCodeAndPlusCodePrefixTags,
  NOSTR_EXPIRATION_TAG_NAME,
} from "@trustroots/nr-common";
import { nanoid } from "@reduxjs/toolkit";
import { publishEventTemplatePromiseAction } from "./publish.actions";

const ONE_DAY_SECONDS = 24 * 60 * 60;

export function publishGatheringPromiseAction({
  title,
  description,
  plusCode,
  startTimestamp,
  endTimestamp,
}: {
  title: string;
  description: string;
  plusCode: string;
  /** Unix seconds UTC */
  startTimestamp: number;
  /** Unix seconds UTC, optional */
  endTimestamp?: number;
}) {
  const plusCodeTags = getPlusCodeAndPlusCodePrefixTags(plusCode);

  // Expiry auto-set: end date if provided, otherwise start + 24h
  const expirationTimestamp = endTimestamp ?? startTimestamp + ONE_DAY_SECONDS;

  const tags: string[][] = [
    ["d", nanoid()],
    ...plusCodeTags,
    ["title", title],
    ["start", Math.round(startTimestamp).toString()],
    [NOSTR_EXPIRATION_TAG_NAME, Math.round(expirationTimestamp).toString()],
  ];

  if (endTimestamp !== undefined) {
    tags.push(["end", Math.round(endTimestamp).toString()]);
  }

  const eventTemplate = {
    kind: 30397,
    content: description,
    tags,
    created_at: getCurrentTimestamp(),
  };

  return publishEventTemplatePromiseAction.request({ eventTemplate });
}
