import OpenLocationCode from "open-location-code-typescript";

const GEOHASH_ALPHABET = "0123456789bcdefghjkmnpqrstuvwxyz";

// Longest geohash whose cell is not much finer than the plus code cell, keyed
// by the number of significant plus code digits.
const GEOHASH_LENGTH_FOR_PLUS_CODE_LENGTH: Record<number, number> = {
  2: 2,
  4: 3,
  6: 5,
  8: 6,
};

export function encodeGeohash(
  latitude: number,
  longitude: number,
  precision: number,
): string {
  const latitudeRange = [-90, 90];
  const longitudeRange = [-180, 180];
  let hash = "";
  let bits = 0;
  let bitCount = 0;
  let isLongitudeBit = true;

  while (hash.length < precision) {
    const range = isLongitudeBit ? longitudeRange : latitudeRange;
    const value = isLongitudeBit ? longitude : latitude;
    const middle = (range[0] + range[1]) / 2;
    bits <<= 1;
    if (value >= middle) {
      bits |= 1;
      range[0] = middle;
    } else {
      range[1] = middle;
    }
    isLongitudeBit = !isLongitudeBit;
    bitCount++;

    if (bitCount === 5) {
      hash += GEOHASH_ALPHABET[bits];
      bits = 0;
      bitCount = 0;
    }
  }

  return hash;
}

export function getGeohashPrefixes(geohash: string): string[] {
  return Array.from({ length: geohash.length }, (_, index) =>
    geohash.slice(0, index + 1),
  );
}

export function getGeohashTagsForPlusCode(plusCode: string): string[][] {
  const significantLength = plusCode.split("+")[0].replace(/0+$/, "").length;
  const geohashLength =
    GEOHASH_LENGTH_FOR_PLUS_CODE_LENGTH[significantLength] ?? 6;
  const { latitudeCenter, longitudeCenter } = OpenLocationCode.decode(plusCode);
  const geohash = encodeGeohash(latitudeCenter, longitudeCenter, geohashLength);
  return getGeohashPrefixes(geohash).map((prefix) => ["g", prefix]);
}
