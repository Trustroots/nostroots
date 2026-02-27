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

  const prevPing = currentState["nr-server-ping"];
  if (prevPing !== undefined && prevPing !== report.nrServerPing.status) {
    changed = true;
  }
  currentState["nr-server-ping"] = report.nrServerPing.status;

  return changed;
}
