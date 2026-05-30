import { config } from "./src/config.ts";
import { runPing } from "./src/ping.ts";
import { checkAllServices } from "./src/health-check.ts";
import { log } from "./src/log.ts";
import { updateState } from "./src/state.ts";
import {
  formatStatusMessage,
  NamedPingResult,
  sendTelegramMessage,
  StatusReport,
} from "./src/telegram.ts";

async function runChecks(): Promise<StatusReport> {
  const [services, ...pingResults] = await Promise.all([
    checkAllServices(config.services),
    ...config.pings.map((p) =>
      runPing(p.name, config.relayWsUrl, p.pubkey, config.pingTimeoutSeconds)
    ),
  ]);

  const pings: NamedPingResult[] = config.pings.map((p, i) => ({
    name: p.name,
    ...pingResults[i],
  }));

  return { services, pings };
}

function logStatus(report: StatusReport): void {
  for (const service of report.services) {
    const error = service.status === "error" && service.error
      ? ` (${service.error})`
      : "";
    log.info(`#Gh2Jk3   ${service.name}: ${service.status}${error}`);
  }
  for (const ping of report.pings) {
    const duration = ping.durationMs ? ` (${ping.durationMs}ms)` : "";
    const error = ping.status === "error" && ping.error
      ? ` (${ping.error})`
      : "";
    log.info(`#Mn4Pq5   ${ping.name} ping: ${ping.status}${duration}${error}`);
  }
}

async function runOnce(): Promise<void> {
  log.info(`#Rs6Tu7 Running health checks...`);

  const report = await runChecks();
  const statusChanged = updateState(report);

  logStatus(report);

  if (statusChanged) {
    log.info("#Vw8Xy9 Status changed, sending Telegram notification...");
    await sendTelegramMessage(formatStatusMessage(report));
  }
}

async function runLoop(): Promise<void> {
  if (config.startupDelayMs > 0) {
    log.info(
      `#Ab1Cd2 Waiting ${config.startupDelayMs}ms before starting health monitor...`,
    );
    await new Promise((resolve) => setTimeout(resolve, config.startupDelayMs));
  }

  log.info(
    `#De3Fg4 Starting health monitor with ${config.checkIntervalMs}ms interval`,
  );

  while (true) {
    try {
      await runOnce();
    } catch (error) {
      log.error("#Hi5Jk6 Error during health check:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, config.checkIntervalMs));
  }
}

if (Deno.args.includes("--check-once")) {
  await runOnce();
} else {
  await runLoop();
}
