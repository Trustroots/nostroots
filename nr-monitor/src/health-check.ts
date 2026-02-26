import { config, ServiceConfig } from "./config.ts";

export type ServiceStatus = "ok" | "error";

export interface ServiceResult {
  name: string;
  displayName: string;
  status: ServiceStatus;
}

export async function checkService(
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

export async function checkAllServices(
  services: ServiceConfig[],
): Promise<ServiceResult[]> {
  return await Promise.all(services.map(checkService));
}
