import { isTrustedOrigin, normalizeOrigin } from "./origins";
import { readAllowedOrigins, rememberAllowedOrigin, type ExtensionStorage } from "./storage";

export type PermissionDecision = "allowed" | "prompt" | "blocked";

export async function permissionDecisionForOrigin(
  rawOrigin: string,
  storage?: ExtensionStorage,
): Promise<PermissionDecision> {
  const origin = normalizeOrigin(rawOrigin);
  if (!origin) return "blocked";
  if (isTrustedOrigin(origin)) return "allowed";
  const remembered = await readAllowedOrigins(storage);
  return remembered.includes(origin) ? "allowed" : "prompt";
}

export async function rememberOriginIfRequested(
  origin: string,
  remember: boolean,
  storage?: ExtensionStorage,
): Promise<void> {
  if (remember) {
    await rememberAllowedOrigin(origin, storage);
  }
}
