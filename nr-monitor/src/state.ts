import { StatusReport } from "./telegram.ts";

type ServiceStatus = "ok" | "error";
type State = Record<string, ServiceStatus>;

let currentState: State | undefined;

export function updateState(report: StatusReport): boolean {
  const isFirstRun = currentState === undefined;
  if (isFirstRun) {
    currentState = {};
  }

  let changed = false;

  for (const service of report.services) {
    const prev = currentState[service.name];
    if (prev !== service.status) {
      changed = true;
    }
    currentState[service.name] = service.status;
  }

  for (const ping of report.pings) {
    const key = `${ping.name}-ping`;
    const prev = currentState[key];
    if (prev !== ping.status) {
      changed = true;
    }
    currentState[key] = ping.status;
  }

  return changed;
}
