import * as SecureStore from "expo-secure-store";

const secureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export async function readStringListPreference(key: string): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export async function writeStringListPreference(
  key: string,
  values: readonly string[],
): Promise<void> {
  await SecureStore.setItemAsync(
    key,
    JSON.stringify(Array.from(new Set(values)).sort()),
    secureStoreOptions,
  );
}

export async function clearPreference(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
