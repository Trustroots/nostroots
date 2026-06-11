import { isKnownNip7Method, type Nip7Method } from "@/browser/nip7-bridge";
import {
  clearPreference,
  readStringListPreference,
  writeStringListPreference,
} from "@/browser/preferences";
import {
  STORAGE_NIP7_ALLOWED_ORIGINS_KEY,
  STORAGE_NIP7_TRUSTED_USE_ORIGINS_KEY,
  TRUSTED_NIP7_DOMAINS,
} from "@/constants";

export type Nip7PermissionEntryKind = "trusted" | "remembered";

export interface Nip7PermissionEntry {
  id: string;
  origin: string;
  method: Nip7Method;
  displayName: string;
  detail: string;
  kind: Nip7PermissionEntryKind;
  canRevoke: boolean;
}

const methodLabels: Record<Nip7Method, string> = {
  getPublicKey: "Read public key",
  signEvent: "Sign events",
  "nip44.encrypt": "NIP-44 encrypt",
  "nip44.decrypt": "NIP-44 decrypt",
  "nip04.encrypt": "NIP-04 encrypt",
  "nip04.decrypt": "NIP-04 decrypt",
};

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

function permissionId(origin: string, method: Nip7Method): string {
  return JSON.stringify([origin, method]);
}

function parsePermissionId(
  value: string,
): { origin: string; method: Nip7Method } | null {
  try {
    const parsed = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "string" &&
      isKnownNip7Method(parsed[1])
    ) {
      return { origin: parsed[0], method: parsed[1] };
    }
  } catch {
    // Older dev builds stored bare origins. Treat them as pubkey-only access.
    const origin = originForUrl(value);
    if (origin) return { origin, method: "getPublicKey" };
  }
  return null;
}

async function readRememberedPermissions(): Promise<
  Array<{ origin: string; method: Nip7Method }>
> {
  return (await readStringListPreference(STORAGE_NIP7_ALLOWED_ORIGINS_KEY))
    .map(parsePermissionId)
    .filter((value): value is { origin: string; method: Nip7Method } =>
      Boolean(value),
    );
}

export async function isRememberedOrigin(
  origin: string,
  method: Nip7Method,
): Promise<boolean> {
  return (await readRememberedPermissions()).some(
    (permission) =>
      permission.origin === origin && permission.method === method,
  );
}

export async function rememberOrigin(
  origin: string,
  method: Nip7Method,
): Promise<void> {
  const permissions = await readRememberedPermissions();
  await writeStringListPreference(STORAGE_NIP7_ALLOWED_ORIGINS_KEY, [
    ...permissions.map((permission) =>
      permissionId(permission.origin, permission.method),
    ),
    permissionId(origin, method),
  ]);
}

export async function revokeOrigin(
  origin: string,
  method?: Nip7Method,
): Promise<void> {
  const permissions = await readRememberedPermissions();
  await writeStringListPreference(
    STORAGE_NIP7_ALLOWED_ORIGINS_KEY,
    permissions
      .filter(
        (permission) =>
          permission.origin !== origin ||
          (method ? permission.method !== method : false),
      )
      .map((permission) => permissionId(permission.origin, permission.method)),
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
      method: "getPublicKey" as const,
      displayName: hostForOrigin(origin),
      detail: `Trusted ${trustedDomainLabel(origin) || "website"} site`,
      kind: "trusted" as const,
      canRevoke: false,
    }));

  const rememberedEntries = allowedOrigins
    .map(parsePermissionId)
    .filter((value): value is { origin: string; method: Nip7Method } =>
      Boolean(value),
    )
    .map(({ origin, method }) => ({
      id: `${permissionId(origin, method)}-remembered`,
      origin,
      method,
      displayName: hostForOrigin(origin),
      detail: methodLabels[method],
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
