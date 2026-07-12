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
