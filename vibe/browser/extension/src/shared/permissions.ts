import { isTrustedOrigin, normalizeOrigin } from "./origins";
import type { Nip07Method } from "./constants";
import {
  readAllowedOriginAccess,
  rememberAllowedOrigin,
  rememberAllowedOriginMethod,
  type ExtensionStorage,
} from "./storage";

export type PermissionDecision = "allowed" | "prompt" | "blocked";

export async function permissionDecisionForOrigin(
  rawOrigin: string,
  method?: Nip07Method,
  storage?: ExtensionStorage,
): Promise<PermissionDecision> {
  const origin = normalizeOrigin(rawOrigin);
  if (!origin) return "blocked";
  if (isTrustedOrigin(origin)) return "allowed";
  const remembered = await readAllowedOriginAccess(storage);
  const access = remembered.find((entry) => entry.origin === origin);
  if (!access) return "prompt";
  if (access.all) return "allowed";
  return method && access.methods.includes(method) ? "allowed" : "prompt";
}

export async function rememberOriginIfRequested(
  origin: string,
  method: Nip07Method,
  decision: "allow_once" | "always_allow_method" | "always_allow_all" | "deny",
  storage?: ExtensionStorage,
): Promise<void> {
  if (decision === "always_allow_all") {
    await rememberAllowedOrigin(origin, storage);
  } else if (decision === "always_allow_method") {
    await rememberAllowedOriginMethod(origin, method, storage);
  }
}
