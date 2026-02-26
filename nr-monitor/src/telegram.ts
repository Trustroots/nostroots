import { config } from "./config.ts";
import { ServiceResult } from "./health-check.ts";
import { E2EResult } from "./e2e-test.ts";

export interface StatusReport {
  services: ServiceResult[];
  e2e: E2EResult;
}

interface TelegramMessage {
  message_id: number;
}

interface TelegramMethods {
  sendMessage: {
    params: {
      chat_id: string;
      text: string;
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
    };
    result: TelegramMessage;
  };
  editMessageText: {
    params: {
      chat_id: string;
      message_id: number;
      text: string;
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
    };
    result: TelegramMessage;
  };
}

type TelegramResponse<T> =
  | { ok: true; result: T }
  | { ok: false; description: string };

let lastMessageId: number | null = null;

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
    lines.push(`${icon} ${service.displayName}`);
  }

  // E2E test as a service
  if (report.e2e.status === "ok") {
    const duration = report.e2e.durationMs
      ? report.e2e.durationMs >= 1000
        ? `${(report.e2e.durationMs / 1000).toFixed(1)}s`
        : `${report.e2e.durationMs}ms`
      : "";
    const durationSuffix = duration ? ` — ${duration}` : "";
    lines.push(`🟢 E2E Test${durationSuffix}`);
  } else {
    const reason = report.e2e.error ? ` — ${report.e2e.error}` : "";
    lines.push(`🔴 E2E Test${reason}`);
  }

  // Footer with operational count
  const serviceUpCount = report.services.filter(
    (s) => s.status === "ok",
  ).length;
  const e2eUp = report.e2e.status === "ok" ? 1 : 0;
  const totalUp = serviceUpCount + e2eUp;
  const total = report.services.length + 1;

  lines.push("");
  lines.push(`── ${totalUp}/${total} operational ──`);

  return lines.join("\n");
}

async function callTelegram<M extends keyof TelegramMethods>(
  method: M,
  params: TelegramMethods[M]["params"],
): Promise<TelegramResponse<TelegramMethods[M]["result"]>> {
  const url = `https://api.telegram.org/bot${config.telegramBot}/${method}`;

  const stringParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      stringParams[key] = String(value);
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(stringParams),
  });

  if (!response.ok) {
    console.error(`Telegram ${method} failed: ${response.status}`);
    return { ok: false, description: `HTTP ${response.status}` };
  }

  return await response.json();
}

export async function sendStatusUpdate(
  message: string,
  statusChanged: boolean,
) {
  // Edit existing message if no change
  if (!statusChanged && lastMessageId !== null) {
    return await callTelegram("editMessageText", {
      chat_id: config.telegramChat,
      message_id: lastMessageId,
      text: message,
      parse_mode: "HTML",
    });
  }

  // Send new message on status change or first run
  const result = await callTelegram("sendMessage", {
    chat_id: config.telegramChat,
    text: message,
    parse_mode: "HTML",
  });

  if (result.ok && result.result) {
    lastMessageId = result.result.message_id;
  }

  return result;
}
