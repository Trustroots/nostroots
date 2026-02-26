import { config } from "./src/config.ts";
import { runE2ETest } from "./src/e2e-test.ts";
import { checkAllServices } from "./src/health-check.ts";
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
    console.log(`#Gh2Jk3   ${service.displayName}: ${service.status}`);
  }
  const duration = report.e2e.durationMs
    ? ` (${report.e2e.durationMs}ms)`
    : "";
  console.log(`#Mn4Pq5   E2E Pipeline: ${report.e2e.status}${duration}`);
}

async function runOnce(): Promise<void> {
  console.log(`#Rs6Tu7 [${new Date().toISOString()}] Running health checks...`);

  const report = await runChecks();
  const statusChanged = updateState(report);

  logStatus(report);

  if (statusChanged) {
    console.log("#Vw8Xy9 Status changed, sending new notification...");
  } else {
    console.log("#Za1Bc2 No status change, updating existing message...");
  }

  await sendStatusUpdate(formatStatusMessage(report), statusChanged);
}

async function runLoop(): Promise<void> {
  console.log(
    `#De3Fg4 Starting health monitor with ${config.checkIntervalMs}ms interval`,
  );

  while (true) {
    try {
      await runOnce();
    } catch (error) {
      console.error("#Hi5Jk6 Error during health check:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, config.checkIntervalMs));
  }
}

if (Deno.args.includes("--check-once")) {
  await runOnce();
} else {
  await runLoop();
}
