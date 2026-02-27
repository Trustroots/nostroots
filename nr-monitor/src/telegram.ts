import { config } from "./config.ts";
import { ServiceResult } from "./health-check.ts";
import { PingResult } from "./ping.ts";
import { log } from "./log.ts";

export interface NamedPingResult extends PingResult {
  name: string;
}

export interface StatusReport {
  services: ServiceResult[];
  pings: NamedPingResult[];
}

function formatPingLine(name: string, ping: PingResult): string {
  if (ping.status === "ok") {
    const duration = ping.durationMs
      ? ping.durationMs >= 1000
        ? `${(ping.durationMs / 1000).toFixed(1)}s`
        : `${ping.durationMs}ms`
      : "";
    const durationSuffix = duration ? ` — ${duration}` : "";
    return `🟢 ${name}${durationSuffix}`;
  }
  const reason = ping.error ? ` — ${ping.error}` : "";
  return `🔴 ${name}${reason}`;
}

export function formatStatusMessage(report: StatusReport): string {
  const lines: string[] = [];

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

  for (const service of report.services) {
    const icon = service.status === "ok" ? "🟢" : "🔴";
    const reason = service.status === "error" && service.error
      ? ` — ${service.error}`
      : "";
    lines.push(`${icon} ${service.name}${reason}`);
  }

  for (const ping of report.pings) {
    lines.push(formatPingLine(`${ping.name} ping`, ping));
  }

  const serviceUpCount = report.services.filter(
    (s) => s.status === "ok",
  ).length;
  const pingUpCount = report.pings.filter((p) => p.status === "ok").length;
  const totalUp = serviceUpCount + pingUpCount;
  const total = report.services.length + report.pings.length;

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
