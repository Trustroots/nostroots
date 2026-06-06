import { NostrEvent } from "nostr-tools";

/**
 * Check if a Nostr event represents a gathering (community event)
 * by looking for the presence of a "start" tag.
 */
export function isGatheringEvent(event: NostrEvent): boolean {
  return event.tags.some((tag) => tag[0] === "start" && tag.length >= 2);
}

/**
 * Get the title from a gathering event's "title" tag.
 */
export function getGatheringTitle(event: NostrEvent): string | undefined {
  const tag = event.tags.find((t) => t[0] === "title");
  return tag?.[1];
}

/**
 * Get the start timestamp (unix seconds) from a gathering event.
 */
export function getGatheringStart(event: NostrEvent): number | undefined {
  const tag = event.tags.find((t) => t[0] === "start");
  if (!tag?.[1]) return undefined;
  const val = parseInt(tag[1], 10);
  return isNaN(val) ? undefined : val;
}

/**
 * Get the end timestamp (unix seconds) from a gathering event.
 */
export function getGatheringEnd(event: NostrEvent): number | undefined {
  const tag = event.tags.find((t) => t[0] === "end");
  if (!tag?.[1]) return undefined;
  const val = parseInt(tag[1], 10);
  return isNaN(val) ? undefined : val;
}

/**
 * Format a unix timestamp for display in the user's local timezone.
 * Returns something like "Jun 15, 3:00 PM"
 */
export function formatGatheringDateTime(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Get the user's timezone abbreviation, e.g. "CET", "PST"
 */
export function getLocalTimezoneAbbr(): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "short",
    }).formatToParts(new Date());
    const tz = parts.find((p) => p.type === "timeZoneName");
    return tz?.value ?? "";
  } catch {
    return "";
  }
}

/**
 * Count upcoming (not yet ended) gathering events from a list.
 */
export function countUpcomingGatherings(events: NostrEvent[]): number {
  const now = Math.floor(Date.now() / 1000);
  return events.filter((e) => {
    if (!isGatheringEvent(e)) return false;
    const end = getGatheringEnd(e);
    const start = getGatheringStart(e);
    // If has end, check end > now; otherwise check start > now
    const relevantTime = end ?? start;
    return relevantTime !== undefined && relevantTime > now;
  }).length;
}
