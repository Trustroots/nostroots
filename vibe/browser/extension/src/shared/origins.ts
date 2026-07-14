import { TRUSTED_DOMAINS } from "./constants";

export function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

export function hostForOrigin(origin: string): string {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return origin.toLowerCase();
  }
}

export function isTrustedOrigin(origin: string): boolean {
  const host = hostForOrigin(origin);
  return TRUSTED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function isExtensionAllowedPageOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
  } catch {
    return false;
  }
}
