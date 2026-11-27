import {
  encodeGeohash,
  getGeohashTagsForPlusCode,
  getGeohashPrefixes,
} from "./geohash.utils";

describe("encodeGeohash", () => {
  it.each([
    [57.64911, 10.40744, 11, "u4pruydqqvj"],
    [42.6, -5.6, 5, "ezs42"],
    [-25.382708, -49.265506, 8, "6gkzwgjz"],
    [0, 0, 1, "s"],
  ])("encodes (%p, %p) at precision %p as %p", (lat, lon, precision, hash) => {
    expect(encodeGeohash(lat, lon, precision)).toBe(hash);
  });
});

describe("getGeohashPrefixes", () => {
  it("returns every prefix from shortest to longest", () => {
    expect(getGeohashPrefixes("ezs42")).toEqual([
      "e",
      "ez",
      "ezs",
      "ezs4",
      "ezs42",
    ]);
  });
});

describe("getGeohashTagsForPlusCode", () => {
  it("tags a full 8-digit plus code with cascading 6-character geohashes", () => {
    const tags = getGeohashTagsForPlusCode("9F4MGC22+");

    expect(tags).toHaveLength(6);
    expect(tags.every(([name]) => name === "g")).toBe(true);
    const longest = tags[tags.length - 1][1];
    expect(longest).toHaveLength(6);
    expect(tags.map(([, value]) => value)).toEqual(getGeohashPrefixes(longest));
  });

  it.each([
    ["9F000000+", 2],
    ["9F4M0000+", 3],
    ["9F4MGC00+", 5],
    ["9F4MGC22+", 6],
  ])(
    "does not claim more precision than the plus code %p (%p characters)",
    (plusCode, length) => {
      const tags = getGeohashTagsForPlusCode(plusCode);
      expect(tags[tags.length - 1][1]).toHaveLength(length);
    },
  );

  it("encodes the centre of the plus code area", () => {
    // 9F4MGC22+ is in Berlin; its centre lies inside geohash u33d.
    const tags = getGeohashTagsForPlusCode("9F4MGC22+");
    expect(tags[3]).toEqual(["g", "u33d"]);
  });
});
