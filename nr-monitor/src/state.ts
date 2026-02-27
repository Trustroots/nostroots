import { StatusReport } from "./telegram.ts";

type ServiceStatus = "ok" | "error";
type State = Record<string, ServiceStatus>;

let currentState: State = {};

export function updateState(report: StatusReport): boolean {
  let changed = false;

  for (const service of report.services) {
    const prev = currentState[service.name];
    if (prev !== undefined && prev !== service.status) {
      changed = true;
    }
    currentState[service.name] = service.status;
  }

  for (const ping of report.pings) {
    const key = `${ping.name}-ping`;
    const prev = currentState[key];
    if (prev !== undefined && prev !== ping.status) {
      changed = true;
    }
    currentState[key] = ping.status;
  }

  return changed;
}
