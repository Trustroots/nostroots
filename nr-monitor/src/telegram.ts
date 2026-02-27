import { config } from "./config.ts";
import { ServiceResult } from "./health-check.ts";
import { NrServerPingResult } from "./nr-server-ping.ts";
import { log } from "./log.ts";

export interface StatusReport {
  services: ServiceResult[];
  nrServerPing: NrServerPingResult;
}

export function formatStatusMessage(report: StatusReport): string {
  const lines: string[] = [];

  // Header with timestamp
  const now = new Date();
  const formatted = now.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  lines.push(`📡 <b>Nostroots Status</b> — ${formatted} UTC`);
  lines.push("");

  // Services
  for (const service of report.services) {
    const icon = service.status === "ok" ? "🟢" : "🔴";
    const reason =
      service.status === "error" && service.error
        ? ` — ${service.error}`
        : "";
    lines.push(`${icon} ${service.name}${reason}`);
  }

  // nr-server ping
  if (report.nrServerPing.status === "ok") {
    const duration = report.nrServerPing.durationMs
      ? report.nrServerPing.durationMs >= 1000
        ? `${(report.nrServerPing.durationMs / 1000).toFixed(1)}s`
        : `${report.nrServerPing.durationMs}ms`
      : "";
    const durationSuffix = duration ? ` — ${duration}` : "";
    lines.push(`🟢 nr-server Ping${durationSuffix}`);
  } else {
    const reason = report.nrServerPing.error
      ? ` — ${report.nrServerPing.error}`
      : "";
    lines.push(`🔴 nr-server Ping${reason}`);
  }

  // Footer with operational count
  const serviceUpCount = report.services.filter(
    (s) => s.status === "ok",
  ).length;
  const pingUp = report.nrServerPing.status === "ok" ? 1 : 0;
  const totalUp = serviceUpCount + pingUp;
  const total = report.services.length + 1;

  lines.push("");
  lines.push(`── ${totalUp}/${total} operational ──`);

  return lines.join("\n");
}

export async function sendTelegramMessage(message: string) {
  const url = `https://api.telegram.org/bot${config.telegramBot}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      chat_id: config.telegramChat,
      text: message,
      parse_mode: "HTML",
    }),
  });

  if (!response.ok) {
    log.error(`#Lm7No8 Telegram sendMessage failed: ${response.status}`);
  }
}
