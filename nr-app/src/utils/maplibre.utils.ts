/**
 * Utilities for converting Redux events + profiles into a GeoJSON
 * FeatureCollection for MapLibre — grouped by plus code at the
 * appropriate precision for the current zoom level.
 */
import { SIGNAL_INTENTS } from "@/constants/signals";
import { EventWithMetadata } from "@/redux/slices/events.slice";
import { NostrProfile } from "@/redux/slices/profiles.slice";
import { plusCodeToCoordinates } from "@/utils/map.utils";
import {
  getAuthorFromEvent,
  getFirstLabelValueFromEvent,
  OPEN_LOCATION_CODE_LABEL_NAMESPACE,
} from "@trustroots/nr-common";

export interface PlusCodeMarkerProperties {
  plusCode: string;
  count: number;
  /** Most recent intent label (if any) */
  intentLabel: string | undefined;
  /** Display name of most recent poster */
  displayName: string | undefined;
  /** Avatar URL of most recent poster */
  avatarUrl: string | undefined;
}

export type MapGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  PlusCodeMarkerProperties
>;

/**
 * Determine plus code precision from MapLibre zoom level.
 * Higher zoom → more precise plus codes → more granular markers.
 *
 *   Zoom 0–3   → 2-char (region-level, ~110km)
 *   Zoom 4–6   → 4-char (area-level, ~5km)
 *   Zoom 7–9   → 6-char (neighborhood, ~250m)
 *   Zoom 10–12 → 8-char (building-level, ~14m)
 *   Zoom 13+   → 10-char (precise, ~3m)
 */
export function zoomToPlusCodeLength(zoom: number): number {
  if (zoom <= 3) return 2;
  if (zoom <= 6) return 4;
  if (zoom <= 9) return 6;
  if (zoom <= 12) return 8;
  return 10;
}

/**
 * Truncate a plus code to a given character length.
 * Plus codes have a "+" at position 8, so we handle that:
 *   "8FVC2222+22" at length 2 → "8F"
 *   "8FVC2222+22" at length 4 → "8FVC"
 *   "8FVC2222+22" at length 6 → "8FVC22"
 *   "8FVC2222+22" at length 8 → "8FVC2222+"
 *
 * We strip the "+" and take `length` characters, then re-add "+"
 * for lengths >= 8 so it's a valid plus code for coordinate lookup.
 */
export function truncatePlusCode(plusCode: string, length: number): string {
  const stripped = plusCode.replace("+", "");
  const truncated = stripped.substring(0, length);
  // Pad to 8 chars with 0s and add + to make it a valid full code for decoding
  return truncated.padEnd(8, "0") + "+";
}

/**
 * Extract the intent emoji and label from event tags.
 */
export function getIntentFromEvent(
  tags: string[][],
): { emoji: string; label: string } | undefined {
  for (const tag of tags) {
    if (tag[0] !== "t" || tag[1] === "signal") continue;
    const intent = SIGNAL_INTENTS.find((i) => i.key === tag[1]);
    if (intent) return { emoji: intent.emoji, label: intent.label };
  }
  return undefined;
}

/**
 * Group events by plus code at the given precision and produce one GeoJSON
 * Point per group, placed at the truncated plus code's center.
 */
export function eventsToGeoJSON(
  events: EventWithMetadata[],
  profilesByPubkey: Record<string, NostrProfile>,
  plusCodeLength: number = 8,
): MapGeoJSON {
  const byPlusCode = new Map<
    string,
    { events: EventWithMetadata[] }
  >();

  for (const ewm of events) {
    const fullPlusCode = getFirstLabelValueFromEvent(
      ewm.event,
      OPEN_LOCATION_CODE_LABEL_NAMESPACE,
    );
    if (!fullPlusCode) continue;

    const groupKey = truncatePlusCode(fullPlusCode, plusCodeLength);

    const existing = byPlusCode.get(groupKey);
    if (existing) {
      existing.events.push(ewm);
    } else {
      byPlusCode.set(groupKey, { events: [ewm] });
    }
  }

  const features: GeoJSON.Feature<GeoJSON.Point, PlusCodeMarkerProperties>[] = [];

  for (const [groupCode, { events: cellEvents }] of byPlusCode) {
    let coords: { latitude: number; longitude: number };
    try {
      coords = plusCodeToCoordinates(groupCode);
    } catch {
      continue;
    }

    // Most recent event provides metadata
    cellEvents.sort((a, b) => b.event.created_at - a.event.created_at);
    const mostRecent = cellEvents[0].event;

    const pubkey = getAuthorFromEvent(mostRecent) ?? mostRecent.pubkey;
    const profile = profilesByPubkey[pubkey];
    const intent = getIntentFromEvent(mostRecent.tags);

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [coords.longitude, coords.latitude],
      },
      properties: {
        plusCode: groupCode,
        count: cellEvents.length,
        intentLabel: intent?.label,
        displayName: profile?.name,
        avatarUrl: profile?.picture,
      },
    });
  }

  return { type: "FeatureCollection", features };
}

/**
 * Create a debounced version of a function.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}
