import { isValidUnixSeconds } from "@/utils/event-gathering.utils";
import { getGeohashTagsForPlusCode } from "@/utils/geohash.utils";
import {
  CALENDAR_TIME_EVENT_KIND,
  CONTENT_MAXIMUM_LENGTH,
  CONTENT_MINIMUM_LENGTH,
  getCurrentTimestamp,
  getPlusCodeAndPlusCodePrefixTags,
  NOSTR_EXPIRATION_TAG_NAME,
} from "@trustroots/nr-common";
import { nanoid } from "@reduxjs/toolkit";
import { publishEventTemplatePromiseAction } from "./publish.actions";

const ONE_DAY_SECONDS = 24 * 60 * 60;

function getDayIndexTags(start: number, end?: number): string[][] {
  const firstDay = Math.floor(start / ONE_DAY_SECONDS);
  const lastDay =
    end === undefined ? firstDay : Math.floor((end - 1) / ONE_DAY_SECONDS);
  const tags: string[][] = [];
  for (let day = firstDay; day <= lastDay; day++) {
    tags.push(["D", String(day)]);
  }
  return tags;
}

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
  if (description.length < CONTENT_MINIMUM_LENGTH) {
    throw new Error(
      `Description must be at least ${CONTENT_MINIMUM_LENGTH} characters`,
    );
  }

  if (description.length > CONTENT_MAXIMUM_LENGTH) {
    throw new Error(
      `Description must be at most ${CONTENT_MAXIMUM_LENGTH} characters`,
    );
  }

  if (!isValidUnixSeconds(startTimestamp)) {
    throw new Error("Start time is invalid");
  }

  if (
    endTimestamp !== undefined &&
    (!isValidUnixSeconds(endTimestamp) || endTimestamp <= startTimestamp)
  ) {
    throw new Error("End time must be after start time");
  }

  const plusCodeTags = getPlusCodeAndPlusCodePrefixTags(plusCode);

  // Expiry auto-set: end date if provided, otherwise start + 24h
  const expirationTimestamp = endTimestamp ?? startTimestamp + ONE_DAY_SECONDS;

  const tags: string[][] = [
    ["d", nanoid()],
    ["title", title],
    ["start", Math.round(startTimestamp).toString()],
  ];

  if (endTimestamp !== undefined) {
    tags.push(["end", Math.round(endTimestamp).toString()]);
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timeZone) {
    tags.push(["start_tzid", timeZone]);
  }

  tags.push(...getDayIndexTags(startTimestamp, endTimestamp));

  tags.push(...getGeohashTagsForPlusCode(plusCode), ...plusCodeTags, [
    NOSTR_EXPIRATION_TAG_NAME,
    Math.round(expirationTimestamp).toString(),
  ]);

  const eventTemplate = {
    kind: CALENDAR_TIME_EVENT_KIND,
    content: description,
    tags,
    created_at: getCurrentTimestamp(),
  };

  return publishEventTemplatePromiseAction.request({ eventTemplate });
}
