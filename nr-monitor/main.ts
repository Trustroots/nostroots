import { config } from "./src/config.ts";
import { runNrServerPing } from "./src/nr-server-ping.ts";
import { checkAllServices } from "./src/health-check.ts";
import { log } from "./src/log.ts";
import { updateState } from "./src/state.ts";
import {
  formatStatusMessage,
  sendStatusUpdate,
  StatusReport,
} from "./src/telegram.ts";

async function runChecks(): Promise<StatusReport> {
  const [services, nrServerPing] = await Promise.all([
    checkAllServices(config.services),
    runNrServerPing(
      config.relayWsUrl,
      config.nrServerPingTimeoutSeconds,
    ),
  ]);

  return { services, nrServerPing };
}

function logStatus(report: StatusReport): void {
  for (const service of report.services) {
    const error = service.status === "error" && service.error ? ` (${service.error})` : "";
    log.info(`#Gh2Jk3   ${service.name}: ${service.status}${error}`);
  }
  const duration = report.nrServerPing.durationMs
    ? ` (${report.nrServerPing.durationMs}ms)`
    : "";
  log.info(
    `#Mn4Pq5   nr-server Ping: ${report.nrServerPing.status}${duration}`,
  );
}

async function runOnce(): Promise<void> {
  log.info(`#Rs6Tu7 Running health checks...`);

  const report = await runChecks();
  const statusChanged = updateState(report);

  logStatus(report);

  if (statusChanged) {
    log.info("#Vw8Xy9 Status changed, sending new notification...");
  } else {
    log.info("#Za1Bc2 No status change, updating existing message...");
  }

  await sendStatusUpdate(formatStatusMessage(report), statusChanged);
}

async function runLoop(): Promise<void> {
  if (config.startupDelayMs > 0) {
    log.info(
      `#Ab1Cd2 Waiting ${config.startupDelayMs}ms before starting health monitor...`,
    );
    await new Promise((resolve) =>
      setTimeout(resolve, config.startupDelayMs)
    );
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

    await new Promise((resolve) =>
      setTimeout(resolve, config.checkIntervalMs)
    );
  }
}

if (Deno.args.includes("--check-once")) {
  await runOnce();
} else {
  await runLoop();
}
