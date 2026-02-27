import { config, ServiceConfig } from "./config.ts";
import { log } from "./log.ts";

export type ServiceStatus = "ok" | "error";

export interface ServiceResult {
  name: string;
  status: ServiceStatus;
  error?: string;
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

    if (response.ok) {
      return { name: service.name, status: "ok" };
    }

    const error = `HTTP ${response.status}`;
    log.warn(
      `#hC3kR1 ${service.name} returned ${response.status} from ${service.url}`,
    );
    return { name: service.name, status: "error", error };
  } catch (err) {
    const error =
      err instanceof DOMException && err.name === "AbortError"
        ? "Timeout"
        : err instanceof Error
          ? err.message
          : String(err);
    log.warn(`#hC4mS2 ${service.name} failed: ${error}`);
    return { name: service.name, status: "error", error };
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkService(
  service: ServiceConfig,
): Promise<ServiceResult> {
  let lastResult: ServiceResult = { name: service.name, status: "error" };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    lastResult = await checkServiceOnce(service);
    if (lastResult.status === "ok") return lastResult;
    if (attempt < MAX_ATTEMPTS) {
      log.info(
        `#hC5nT3 ${service.name} attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying...`,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  log.error(
    `#hC6pU4 ${service.name} failed all ${MAX_ATTEMPTS} attempts: ${lastResult.error}`,
  );
  return lastResult;
}

export async function checkAllServices(
  services: ServiceConfig[],
): Promise<ServiceResult[]> {
  return await Promise.all(services.map(checkService));
}
