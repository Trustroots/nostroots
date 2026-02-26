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

  const prevE2e = currentState["e2e-pipeline"];
  if (prevE2e !== undefined && prevE2e !== report.e2e.status) {
    changed = true;
  }
  currentState["e2e-pipeline"] = report.e2e.status;

  return changed;
}
