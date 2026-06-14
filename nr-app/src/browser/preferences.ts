import AsyncStorage from "@react-native-async-storage/async-storage";

export async function readStringListPreference(key: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch (error) {
    console.warn("#N7B3r2-failed-to-parse-nip7-origin-preference", key, error);
    return [];
  }
}

export async function writeStringListPreference(
  key: string,
  values: readonly string[],
): Promise<void> {
  await AsyncStorage.setItem(
    key,
    JSON.stringify(Array.from(new Set(values)).sort()),
  );
}

export async function clearPreference(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}
