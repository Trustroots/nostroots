export const TRUSTROOTS_SUPPORT_URL = "https://www.trustroots.org/support";

export interface DebugInfo {
  appVersion?: string;
  buildNumber?: string | number;
  commitId?: string;
  platform: string;
  platformVersion: string | number;
  updateChannel?: string;
  updateId?: string;
  updateCreatedAt?: Date | null;
  isEmbeddedLaunch: boolean;
  npub?: string;
  trustrootsUsername?: string;
  generatedAt: Date;
}

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Support pastes this into a ticket, so it is plain text rather than JSON and
 * every field is always present -- "not set" is itself diagnostic.
 */
export function formatDebugInfo(info: DebugInfo): string {
  const lines = [
    "Nostroots debug info",
    `Generated: ${formatTimestamp(info.generatedAt)}`,
    "",
    `App version: ${info.appVersion ?? "unknown"}`,
    `Build: ${info.buildNumber ?? "unknown"}`,
    `Commit: ${info.commitId ?? "unknown"}`,
    `Platform: ${info.platform} ${info.platformVersion}`,
    "",
    info.isEmbeddedLaunch
      ? "Update: embedded build (no OTA update applied)"
      : [
          `Update channel: ${info.updateChannel ?? "unknown"}`,
          `Update ID: ${info.updateId ?? "unknown"}`,
          `Update published: ${
            info.updateCreatedAt
              ? formatTimestamp(info.updateCreatedAt)
              : "unknown"
          }`,
        ].join("\n"),
    "",
    `npub: ${info.npub ?? "not set"}`,
    `Trustroots username: ${info.trustrootsUsername ?? "not set"}`,
  ];

  return lines.join("\n");
}

/** Short enough not to nag, long enough to rule out "it's broken". */
export const MIN_USER_MESSAGE_LENGTH = 50;

/**
 * What we offer the user. Deliberately a round number rather than "whatever is
 * left after the debug block", so the limit they see does not drift with OTA
 * metadata. The bridge's SUPPORT_MESSAGE_MAX_LENGTH is the backstop, not the
 * headline, and leaves ample room for the debug block on top of this.
 */
export const MAX_USER_MESSAGE_LENGTH = 500;

const SUPPORT_MESSAGE_SEPARATOR = "\n\n---\n\n";

/**
 * The user's words come first: support reads a person's description before a
 * data dump.
 */
export function formatSupportMessage({
  userMessage,
  debugInfo,
}: {
  userMessage: string;
  debugInfo: string;
}): string {
  return `${userMessage.trim()}${SUPPORT_MESSAGE_SEPARATOR}${debugInfo}`;
}
