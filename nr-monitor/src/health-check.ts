import { config, ServiceConfig } from "./config.ts";

export type ServiceStatus = "ok" | "error";

export interface ServiceResult {
  name: string;
  displayName: string;
  status: ServiceStatus;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

async function checkServiceOnce(
  service: ServiceConfig,
): Promise<ServiceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.healthCheckTimeoutMs,
  );

  try {
    const response = await fetch(service.url, {
      signal: controller.signal,
    });

    return {
      name: service.name,
      displayName: service.displayName,
      status: response.ok ? "ok" : "error",
    };
  } catch {
    return {
      name: service.name,
      displayName: service.displayName,
      status: "error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkService(
  service: ServiceConfig,
): Promise<ServiceResult> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await checkServiceOnce(service);
    if (result.status === "ok") return result;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  return { name: service.name, displayName: service.displayName, status: "error" };
}

export async function checkAllServices(
  services: ServiceConfig[],
): Promise<ServiceResult[]> {
  return await Promise.all(services.map(checkService));
}
