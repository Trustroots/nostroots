import type { ServiceStatus } from "./health-check.ts";
import type { StatusReport } from "./telegram.ts";

const currentState: Record<string, ServiceStatus> = {};

export function updateState(report: StatusReport): boolean {
  const statuses: [string, ServiceStatus][] = [
    ...report.services.map((service): [string, ServiceStatus] => [
      service.name,
      service.status,
    ]),
    ...report.pings.map((ping): [string, ServiceStatus] => [
      `${ping.name}-ping`,
      ping.status,
    ]),
  ];

  let changed = false;
  for (const [key, status] of statuses) {
    if (currentState[key] !== status) {
      changed = true;
    }
    currentState[key] = status;
  }

  return changed;
}
