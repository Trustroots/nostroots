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
