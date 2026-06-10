import { STORAGE_KEYS } from "./constants";
import { extensionApi } from "./extension-api";
import { isHexKey } from "./hex";

export interface ExtensionStorage {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
}

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
  const result = await storage.get(STORAGE_KEYS.allowedOrigins);
  const value = result[STORAGE_KEYS.allowedOrigins];
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((origin): origin is string => typeof origin === "string"))).sort();
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
  const origins = new Set(await readAllowedOrigins(storage));
  origins.add(origin);
  await storage.set({ [STORAGE_KEYS.allowedOrigins]: Array.from(origins).sort() });
}

export async function revokeAllowedOrigin(
  origin: string,
  storage: ExtensionStorage = extensionStorage(),
): Promise<void> {
  const origins = (await readAllowedOrigins(storage)).filter((candidate) => candidate !== origin);
  await storage.set({ [STORAGE_KEYS.allowedOrigins]: origins });
}

export async function clearAllowedOrigins(storage: ExtensionStorage = extensionStorage()): Promise<void> {
  await storage.remove(STORAGE_KEYS.allowedOrigins);
}
