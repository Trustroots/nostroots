import { Event } from "nostr-tools";
import { OpenLocationCode } from "open-location-code";

// Create a singleton instance of OpenLocationCode
const olc = new OpenLocationCode();

/**
 * Get location coordinates from a nostr event's plus code tags
 */
export function getLocationFromEvent(
  event: Event
): { lat: number; lng: number } | null {
  // Look for open-location-code label tag
  const locationTag = event.tags.find(
    (tag) => tag[0] === "l" && tag[2] === "open-location-code"
  );

  if (!locationTag || !locationTag[1]) {
    return null;
  }

  const plusCode = locationTag[1];

  try {
    // Validate and decode the plus code
    if (!olc.isFull(plusCode)) {
      return null;
    }

    const decoded = olc.decode(plusCode);
    return {
      lat: decoded.latitudeCenter,
      lng: decoded.longitudeCenter,
    };
  } catch (error) {
    console.error("Failed to decode plus code:", plusCode, error);
    return null;
  }
}

/**
 * Format a timestamp as a relative time string (e.g., "2 hours ago")
 */
export function formatDistanceToNow(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? "s" : ""} ago`;
  if (months > 0) return `${months} month${months > 1 ? "s" : ""} ago`;
  if (weeks > 0) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return "just now";
}

/**
 * Get plus code prefix tags for an event
 * Returns prefixes from 2 characters up to the full code length
 * 
 * Plus codes are formatted as: XXXXXXXX+XX (8 chars, +, 2 chars)
 * Prefixes should be: XX000000+, XXXX0000+, XXXXXX00+, XXXXXXXX+, XXXXXXXX+XX
 */
export function getPlusCodePrefixes(plusCode: string): string[] {
  const prefixes: string[] = [];
  const cleanCode = plusCode.replace("+", "");

  // Generate prefixes at each length (2, 4, 6, 8, 10)
  for (let len = 2; len <= cleanCode.length; len += 2) {
    const prefix = cleanCode.slice(0, len);
    // Add back the + for proper formatting
    if (len <= 8) {
      // Pad with zeros and add + at position 8
      const paddedPrefix = prefix + "0".repeat(8 - len) + "+";
      prefixes.push(paddedPrefix);
    } else {
      // For codes longer than 8, format as XXXXXXXX+XX
      prefixes.push(
        prefix.slice(0, 8) + "+" + prefix.slice(8)
      );
    }
  }

  return prefixes;
}
