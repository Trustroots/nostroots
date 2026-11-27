import {
  CALENDAR_TIME_EVENT_KIND,
  getFirstTagValueFromEvent,
} from "@trustroots/nr-common";
import { NostrEvent } from "nostr-tools";

const MAX_UNIX_SECONDS = 8_640_000_000_000;

/** Parses a whole, non-negative unix-seconds timestamp within JS's Date range. */
export function parseUnixSeconds(
  value: string | undefined,
): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= MAX_UNIX_SECONDS
    ? parsed
    : undefined;
}

export function isValidUnixSeconds(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_UNIX_SECONDS;
}

/**
 * Check if a Nostr event is a gathering: a NIP-52 time-based calendar event
 * carrying the mandatory identifier, title and a valid start (and, if present,
 * a valid end after the start). Malformed events are not gatherings.
 */
export function isGatheringEvent(event: NostrEvent): boolean {
  if (event.kind !== CALENDAR_TIME_EVENT_KIND) return false;
  if (!getFirstTagValueFromEvent(event, "d")) return false;
  if (!getFirstTagValueFromEvent(event, "title")?.trim()) return false;

  const start = parseUnixSeconds(getFirstTagValueFromEvent(event, "start"));
  if (start === undefined) return false;

  const endTag = event.tags.find((tag) => tag[0] === "end");
  if (endTag === undefined) return true;
  const end = parseUnixSeconds(endTag[1]);
  return end !== undefined && end > start;
}

/**
 * Get the start timestamp (unix seconds) from a gathering event.
 */
export function getGatheringStart(event: NostrEvent): number | undefined {
  return parseUnixSeconds(getFirstTagValueFromEvent(event, "start"));
}

/**
 * Get the end timestamp (unix seconds) from a gathering event.
 */
export function getGatheringEnd(event: NostrEvent): number | undefined {
  return parseUnixSeconds(getFirstTagValueFromEvent(event, "end"));
}

/**
 * A gathering is over once its end (or, without one, its start) has passed.
 */
export function hasGatheringEnded(event: NostrEvent, now: number): boolean {
  const relevantTime = getGatheringEnd(event) ?? getGatheringStart(event);
  return relevantTime === undefined || relevantTime <= now;
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
 * Get the user's UTC offset string, e.g. "UTC+2", "UTC-5", "UTC"
 */
export function getLocalTimezoneAbbr(): string {
  const offsetMin = new Date().getTimezoneOffset();
  if (offsetMin === 0) return "UTC";
  const sign = offsetMin < 0 ? "+" : "-";
  const hours = Math.floor(Math.abs(offsetMin) / 60);
  const mins = Math.abs(offsetMin) % 60;
  return mins === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(mins).padStart(2, "0")}`;
}

/**
 * Start time (unix seconds) of a gathering or of a map note carrying a "start" tag.
 */
export function getEventStart(event: NostrEvent): number | undefined {
  return parseUnixSeconds(getFirstTagValueFromEvent(event, "start"));
}

/**
 * Whether a gathering or "start"-tagged map note is over. Plain notes end at their start.
 */
export function hasEventEnded(event: NostrEvent, now: number): boolean {
  if (isGatheringEvent(event)) return hasGatheringEnded(event, now);
  return (getEventStart(event) ?? event.created_at) < now;
}
