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
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatUpdateLines(info: DebugInfo): string[] {
  if (info.isEmbeddedLaunch) {
    return ["Update: embedded build (no OTA update applied)"];
  }
  return [
    `Update channel: ${info.updateChannel ?? "unknown"}`,
    `Update ID: ${info.updateId ?? "unknown"}`,
    `Update published: ${info.updateCreatedAt ? formatTimestamp(info.updateCreatedAt) : "unknown"}`,
  ];
}

/**
 * Pasted into the support form, so it is plain text rather than JSON and every
 * field is always present -- "not set" is itself diagnostic.
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
    ...formatUpdateLines(info),
    "",
    `npub: ${info.npub ?? "not set"}`,
    `Trustroots username: ${info.trustrootsUsername ?? "not set"}`,
  ];

  return lines.join("\n");
}
