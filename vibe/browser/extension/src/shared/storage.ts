import { isKnownNip07Method, STORAGE_KEYS, type Nip07Method } from "./constants";
import { extensionApi } from "./extension-api";
import { isHexKey } from "./hex";
import { isTrustedOrigin, normalizeOrigin } from "./origins";

export interface ExtensionStorage {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
}

export type AllowedOriginAccess = {
  origin: string;
  all: boolean;
  methods: Nip07Method[];
};

type StoredAllowedOriginAccess = {
  all?: unknown;
  methods?: unknown;
};

export function extensionStorage(): ExtensionStorage {
  return extensionApi.storage.local;
}

export async function readPrivateKeyHex(storage: ExtensionStorage = extensionStorage()): Promise<string | null> {
  const result = await storage.get(STORAGE_KEYS.privateKeyHex);
  const value = result[STORAGE_KEYS.privateKeyHex];
  return isHexKey(value) ? value : null;
}

export async function writePrivateKeyHex(
  privateKeyHex: string,
  storage: ExtensionStorage = extensionStorage(),
): Promise<void> {
  if (!isHexKey(privateKeyHex)) {
    throw new Error("Expected a 64-character private key.");
  }
  await storage.set({ [STORAGE_KEYS.privateKeyHex]: privateKeyHex });
  await clearAllowedOrigins(storage);
}

export async function clearPrivateKey(storage: ExtensionStorage = extensionStorage()): Promise<void> {
  await storage.remove(STORAGE_KEYS.privateKeyHex);
  await clearAllowedOrigins(storage);
}

export async function readAllowedOrigins(storage: ExtensionStorage = extensionStorage()): Promise<string[]> {
  const access = await readAllowedOriginAccess(storage);
  return access.filter((entry) => entry.all).map((entry) => entry.origin);
}

export async function readAllowedOriginAccess(
  storage: ExtensionStorage = extensionStorage(),
): Promise<AllowedOriginAccess[]> {
  const access = await readAllowedOriginAccessRecord(storage);
  return Object.entries(access)
    .map(([origin, entry]) => ({ origin, ...entry }))
    .sort((left, right) => left.origin.localeCompare(right.origin));
}

export async function readCachedTrustrootsNip05(
  publicKeyHex: string,
  storage: ExtensionStorage = extensionStorage(),
): Promise<string | null> {
  const result = await storage.get(STORAGE_KEYS.trustrootsNip05ByPubkey);
  const value = result[STORAGE_KEYS.trustrootsNip05ByPubkey];
  if (!isHexKey(publicKeyHex) || !value || typeof value !== "object" || Array.isArray(value)) return null;

  const cached = (value as Record<string, unknown>)[publicKeyHex.toLowerCase()];
  return typeof cached === "string" && cached ? cached : null;
}

export async function writeCachedTrustrootsNip05(
  publicKeyHex: string,
  nip05: string,
  storage: ExtensionStorage = extensionStorage(),
): Promise<void> {
  const normalizedPubkey = publicKeyHex.toLowerCase();
  if (!isHexKey(normalizedPubkey) || !nip05) return;

  const result = await storage.get(STORAGE_KEYS.trustrootsNip05ByPubkey);
  const value = result[STORAGE_KEYS.trustrootsNip05ByPubkey];
  const cache = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  await storage.set({
    [STORAGE_KEYS.trustrootsNip05ByPubkey]: {
      ...(cache as Record<string, unknown>),
      [normalizedPubkey]: nip05,
    },
  });
}

export async function rememberAllowedOrigin(
  origin: string,
  storage: ExtensionStorage = extensionStorage(),
): Promise<void> {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin || isTrustedOrigin(normalizedOrigin)) return;
  const access = await readAllowedOriginAccessRecord(storage);
  access[normalizedOrigin] = { all: true, methods: access[normalizedOrigin]?.methods ?? [] };
  await writeAllowedOriginAccessRecord(access, storage);
}

export async function rememberAllowedOriginMethod(
  origin: string,
  method: Nip07Method,
  storage: ExtensionStorage = extensionStorage(),
): Promise<void> {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin || isTrustedOrigin(normalizedOrigin)) return;

  const access = await readAllowedOriginAccessRecord(storage);
  const methods = new Set(access[normalizedOrigin]?.methods ?? []);
  methods.add(method);

  access[normalizedOrigin] = {
    all: access[normalizedOrigin]?.all ?? false,
    methods: Array.from(methods).sort(),
  };
  await writeAllowedOriginAccessRecord(access, storage);
}

export async function revokeAllowedOrigin(
  origin: string,
  storage: ExtensionStorage = extensionStorage(),
): Promise<void> {
  const normalizedOrigin = normalizeOrigin(origin);
  const access = await readAllowedOriginAccessRecord(storage);
  if (normalizedOrigin) delete access[normalizedOrigin];
  await writeAllowedOriginAccessRecord(access, storage);
}

export async function clearAllowedOrigins(storage: ExtensionStorage = extensionStorage()): Promise<void> {
  await storage.remove(STORAGE_KEYS.allowedOriginAccess);
}

async function readAllowedOriginAccessRecord(
  storage: ExtensionStorage = extensionStorage(),
): Promise<Record<string, Omit<AllowedOriginAccess, "origin">>> {
  const result = await storage.get(STORAGE_KEYS.allowedOriginAccess);
  const value = result[STORAGE_KEYS.allowedOriginAccess];
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const access: Record<string, Omit<AllowedOriginAccess, "origin">> = {};
  for (const [rawOrigin, rawEntry] of Object.entries(value as Record<string, StoredAllowedOriginAccess>)) {
    const origin = normalizeOrigin(rawOrigin);
    if (!origin || isTrustedOrigin(origin) || !rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
      continue;
    }

    const all = rawEntry.all === true;
    const methods = Array.isArray(rawEntry.methods)
      ? Array.from(new Set(rawEntry.methods.filter(isKnownNip07Method))).sort()
      : [];
    if (all || methods.length > 0) {
      const previous = access[origin] ?? { all: false, methods: [] };
      access[origin] = {
        all: previous.all || all,
        methods: Array.from(new Set([...previous.methods, ...methods])).sort(),
      };
    }
  }
  return access;
}

async function writeAllowedOriginAccessRecord(
  access: Record<string, Omit<AllowedOriginAccess, "origin">>,
  storage: ExtensionStorage,
): Promise<void> {
  await storage.set({ [STORAGE_KEYS.allowedOriginAccess]: access });
}
