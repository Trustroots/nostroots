import { config } from "./src/config.ts";
import { runE2ETest } from "./src/e2e-test.ts";
import { checkAllServices } from "./src/health-check.ts";
import { log } from "./src/log.ts";
import { updateState } from "./src/state.ts";
import {
  formatStatusMessage,
  sendStatusUpdate,
  StatusReport,
} from "./src/telegram.ts";

async function runChecks(): Promise<StatusReport> {
  const [services, e2e] = await Promise.all([
    checkAllServices(config.services),
    runE2ETest(
      config.relayWsUrl,
      config.e2eTestPrivateKeyHex,
      config.e2eTimeoutSeconds,
    ),
  ]);

  return { services, e2e };
}

function logStatus(report: StatusReport): void {
  for (const service of report.services) {
    log.info(`#Gh2Jk3   ${service.displayName}: ${service.status}`);
  }
  const duration = report.e2e.durationMs
    ? ` (${report.e2e.durationMs}ms)`
    : "";
  log.info(`#Mn4Pq5   E2E Pipeline: ${report.e2e.status}${duration}`);
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
    log.info(`#Ab1Cd2 Waiting ${config.startupDelayMs}ms before starting health monitor...`);
    await new Promise((resolve) => setTimeout(resolve, config.startupDelayMs));
  }

  log.info(`#De3Fg4 Starting health monitor with ${config.checkIntervalMs}ms interval`);

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
