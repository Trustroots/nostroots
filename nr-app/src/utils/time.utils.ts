/**
 * Returns a human-readable relative time string.
 * @param timestampSeconds - Unix timestamp in seconds
 * @returns Relative time string like "just now", "5m ago", "2h ago", "3d ago", or date
 */
export function getRelativeTime(timestampSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestampSeconds;

  if (diff < 60) {
    return "just now";
  }

  if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes}m ago`;
  }

  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours}h ago`;
  }

  if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days}d ago`;
  }

  // For older dates, show the actual date
  const date = new Date(timestampSeconds * 1000);
  return date.toLocaleDateString();
}

/**
 * Counts how many timestamps fall within today (UTC).
 */
export function countNotesToday(timestampsSeconds: number[]): number {
  const now = new Date();
  const startOfDay = Math.floor(
    new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ).getTime() / 1000,
  );
  return timestampsSeconds.filter((ts) => ts >= startOfDay).length;
}

/**
 * Returns true if a Unix timestamp (seconds) falls within the last `thresholdHours` hours.
 */
export function isTimestampRecent(
  timestampSeconds: number,
  thresholdHours: number = 3,
): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds - timestampSeconds < thresholdHours * 3600;
}

/**
 * Returns a summary string like "3 notes · 1 today" or "No notes yet".
 */
export function getNoteSummaryText(
  totalCount: number,
  todayCount: number,
): string {
  if (totalCount === 0) {
    return "No notes yet";
  }
  const noteWord = totalCount === 1 ? "note" : "notes";
  if (todayCount > 0) {
    return `${totalCount} ${noteWord} \u00b7 ${todayCount} today`;
  }
  return `${totalCount} ${noteWord}`;
}
