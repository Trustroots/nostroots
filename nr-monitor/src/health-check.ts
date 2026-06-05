import * as amqp from "@nashaddams/amqp";
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

async function checkAmqpServiceOnce(
  service: ServiceConfig,
): Promise<ServiceResult> {
  const url = URL.parse(service.url);
  if (!url) {
    return { name: service.name, status: "error", error: "Invalid AMQP URL" };
  }

  const connectPromise = (async () => {
    const connection = await amqp.connect({
      hostname: url.hostname,
      port: parseInt(url.port || "5672", 10),
      username: url.username || "guest",
      password: url.password || "guest",
    });
    await connection.close();
    return { name: service.name, status: "ok" as const };
  })();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), config.healthCheckTimeoutMs)
  );

  try {
    return await Promise.race([connectPromise, timeoutPromise]);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.warn(`#hC4mS2 ${service.name} failed: ${error}`);
    return { name: service.name, status: "error", error };
  }
}

async function checkServiceOnce(
  service: ServiceConfig,
): Promise<ServiceResult> {
  if (new URL(service.url).protocol === "amqp:") {
    return checkAmqpServiceOnce(service);
  }

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
    const error = err instanceof DOMException && err.name === "AbortError"
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
      log.warn(
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
