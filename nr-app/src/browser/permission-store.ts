import {
  STORAGE_NIP7_ALLOWED_ORIGINS_KEY,
  STORAGE_NIP7_TRUSTED_USE_ORIGINS_KEY,
  TRUSTED_NIP7_DOMAINS,
} from "@/constants";
import {
  clearPreference,
  readStringListPreference,
  writeStringListPreference,
} from "@/browser/preferences";

export type Nip7PermissionEntryKind = "trusted" | "remembered";

export interface Nip7PermissionEntry {
  id: string;
  origin: string;
  displayName: string;
  detail: string;
  kind: Nip7PermissionEntryKind;
  canRevoke: boolean;
}

export function originForUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function hostForOrigin(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

export function isTrustedNip7Origin(origin: string): boolean {
  const host = hostForOrigin(origin).toLowerCase();
  return TRUSTED_NIP7_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

export function trustedDomainLabel(origin: string): string | null {
  const host = hostForOrigin(origin).toLowerCase();
  const domain = TRUSTED_NIP7_DOMAINS.find(
    (candidate) => host === candidate || host.endsWith(`.${candidate}`),
  );
  if (!domain) return null;
  return host === domain ? domain : `*.${domain}`;
}

export async function isRememberedOrigin(origin: string): Promise<boolean> {
  return (
    await readStringListPreference(STORAGE_NIP7_ALLOWED_ORIGINS_KEY)
  ).includes(origin);
}

export async function rememberOrigin(origin: string): Promise<void> {
  const origins = await readStringListPreference(
    STORAGE_NIP7_ALLOWED_ORIGINS_KEY,
  );
  await writeStringListPreference(STORAGE_NIP7_ALLOWED_ORIGINS_KEY, [
    ...origins,
    origin,
  ]);
}

export async function revokeOrigin(origin: string): Promise<void> {
  const origins = await readStringListPreference(
    STORAGE_NIP7_ALLOWED_ORIGINS_KEY,
  );
  await writeStringListPreference(
    STORAGE_NIP7_ALLOWED_ORIGINS_KEY,
    origins.filter((candidate) => candidate !== origin),
  );
}

export async function recordTrustedOriginUse(origin: string): Promise<void> {
  const origins = await readStringListPreference(
    STORAGE_NIP7_TRUSTED_USE_ORIGINS_KEY,
  );
  await writeStringListPreference(STORAGE_NIP7_TRUSTED_USE_ORIGINS_KEY, [
    ...origins,
    origin,
  ]);
}

export async function clearNip7Permissions(): Promise<void> {
  await Promise.all([
    clearPreference(STORAGE_NIP7_ALLOWED_ORIGINS_KEY),
    clearPreference(STORAGE_NIP7_TRUSTED_USE_ORIGINS_KEY),
  ]);
}

export async function getPermissionEntries(): Promise<Nip7PermissionEntry[]> {
  const [allowedOrigins, usedTrustedOrigins] = await Promise.all([
    readStringListPreference(STORAGE_NIP7_ALLOWED_ORIGINS_KEY),
    readStringListPreference(STORAGE_NIP7_TRUSTED_USE_ORIGINS_KEY),
  ]);

  const trustedEntries = usedTrustedOrigins
    .filter(isTrustedNip7Origin)
    .map((origin) => ({
      id: `${origin}-trusted`,
      origin,
      displayName: hostForOrigin(origin),
      detail: `Trusted ${trustedDomainLabel(origin) || "website"} site`,
      kind: "trusted" as const,
      canRevoke: false,
    }));

  const rememberedEntries = allowedOrigins.map((origin) => ({
    id: `${origin}-remembered`,
    origin,
    displayName: hostForOrigin(origin),
    detail: "Always allowed",
    kind: "remembered" as const,
    canRevoke: true,
  }));

  return [...trustedEntries, ...rememberedEntries].sort((left, right) => {
    if (left.displayName === right.displayName) {
      return left.origin.localeCompare(right.origin);
    }
    return left.displayName.localeCompare(right.displayName);
  });
}
