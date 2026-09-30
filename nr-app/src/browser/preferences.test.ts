import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearPreference,
  readStringListPreference,
  writeStringListPreference,
} from "./preferences";

const KEY = "test-origins";

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("string list preferences", () => {
  it("reads an empty list when nothing is stored", async () => {
    await expect(readStringListPreference(KEY)).resolves.toEqual([]);
  });

  it("writes a deduplicated, sorted list", async () => {
    await writeStringListPreference(KEY, ["b", "a", "b"]);

    await expect(AsyncStorage.getItem(KEY)).resolves.toBe('["a","b"]');
    await expect(readStringListPreference(KEY)).resolves.toEqual(["a", "b"]);
  });

  it("drops non-string entries and ignores values that aren't lists", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify(["a", 1, null, "b"]));
    await expect(readStringListPreference(KEY)).resolves.toEqual(["a", "b"]);

    await AsyncStorage.setItem(KEY, JSON.stringify({ a: 1 }));
    await expect(readStringListPreference(KEY)).resolves.toEqual([]);
  });

  it("treats unparseable JSON as an empty list", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await AsyncStorage.setItem(KEY, "{not json");

    await expect(readStringListPreference(KEY)).resolves.toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("clears a preference", async () => {
    await writeStringListPreference(KEY, ["a"]);
    await clearPreference(KEY);

    await expect(readStringListPreference(KEY)).resolves.toEqual([]);
  });
});
