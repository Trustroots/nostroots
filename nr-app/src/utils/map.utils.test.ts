import {
  allPlusCodesForRegion,
  arePlusCodesTheSameLength,
  boundariesToRegion,
  coordinatesToPlusCode,
  filterEventsForPlusCode,
  getAllChildPlusCodes,
  getAllPlusCodesBetweenTwoPlusCodes,
  getEventLinkUrl,
  getLayerForEvent,
  getMapLayer,
  isPlusCodeBetweenTwoPlusCodes,
  isValidPlusCode,
  plusCodeToArrayPairs,
  plusCodeToCoordinates,
  plusCodeHasTrailingZeroes,
  plusCodeToFirstFourSegments,
  plusCodeToRectangle,
  regionToBoundingBox,
} from "./map.utils";
import { MAP_LAYERS } from "@trustroots/nr-common";
import type { EventWithMetadata } from "@/redux/slices/events.slice";

function eventWith({
  kind = 30397,
  plusCode,
  pubkey = "1".repeat(64),
  tags = [],
}: {
  kind?: number;
  plusCode?: string;
  pubkey?: string;
  tags?: string[][];
} = {}): EventWithMetadata {
  return {
    event: {
      content: "",
      created_at: 1,
      id: "0".repeat(64),
      kind,
      pubkey,
      sig: "2".repeat(128),
      tags: plusCode
        ? [
            ["L", "open-location-code"],
            ["l", plusCode, "open-location-code"],
            ...tags,
          ]
        : tags,
    },
    metadata: { seenOnRelays: [] },
  };
}

describe("map.utils", () => {
  describe("plusCodeToFirstFourSegments()", () => {
    it("Splits a valid plus code", () => {
      expect(plusCodeToFirstFourSegments("23456789+")).toEqual([
        "23",
        "45",
        "67",
        "89",
      ]);
    });

    it("throws for an invalid plus code", () => {
      expect(() => plusCodeToFirstFourSegments("00000000+")).toThrow();
    });
  });

  it("validates, encodes, and splits plus codes", () => {
    const berlin = coordinatesToPlusCode({
      latitude: 52.52,
      longitude: 13.405,
      length: 8,
    });

    expect(isValidPlusCode(berlin)).toBe(true);
    expect(isValidPlusCode("not-a-plus-code")).toBe(false);
    expect(plusCodeToArrayPairs("23456789+")).toEqual([
      ["2", "3"],
      ["4", "5"],
      ["6", "7"],
      ["8", "9"],
    ]);
    expect(plusCodeToArrayPairs("9F4G0000+")).toEqual([
      ["9", "F"],
      ["4", "G"],
    ]);
    expect(() => plusCodeToArrayPairs("23456789+AB")).toThrow(
      "Cannot split plus codes with values after the plus",
    );
  });

  it("decodes plus codes into coordinates and rectangles", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation();
    const coordinates = plusCodeToCoordinates("9F4MGCG4+");
    const rectangle = plusCodeToRectangle("9F4MGCG4+");

    expect(coordinates).toEqual(rectangle[2]);
    expect(rectangle).toHaveLength(4);
    expect(rectangle[0].latitude).toBeLessThan(rectangle[1].latitude);
    expect(rectangle[0].longitude).toBeLessThan(rectangle[2].longitude);
    expect(() => plusCodeToCoordinates("invalid")).toThrow();
    expect(() => plusCodeToRectangle("invalid")).toThrow();
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it("covers a visible region with valid plus-code prefixes", () => {
    const codes = allPlusCodesForRegion({
      latitude: 52.52,
      latitudeDelta: 0.01,
      longitude: 13.405,
      longitudeDelta: 0.01,
      codeLength: 6,
    });

    expect(codes.length).toBeGreaterThan(0);
    expect(codes.every(isValidPlusCode)).toBe(true);
  });

  describe("plusCodeHasTrailingZeroes()", () => {
    it("returns false for a single zero", () => {
      expect(plusCodeHasTrailingZeroes("7FG49QG0+")).toEqual(false);
      expect(plusCodeHasTrailingZeroes("7FG49000+")).toEqual(false);
      expect(plusCodeHasTrailingZeroes("7FG00000+")).toEqual(false);
    });

    it("returns false for trailing digits", () => {
      expect(plusCodeHasTrailingZeroes("7FG49QGA+FF")).toEqual(false);
      expect(plusCodeHasTrailingZeroes("7FG49QGA+FFF")).toEqual(false);
    });

    it("returns false for invalid and full-length codes", () => {
      expect(plusCodeHasTrailingZeroes("00000000+")).toBe(false);
      expect(plusCodeHasTrailingZeroes("23456789+")).toBe(false);
    });

    it("returns true for trailing zeroes", () => {
      expect(plusCodeHasTrailingZeroes("7FG49Q00+")).toEqual(true);
      expect(plusCodeHasTrailingZeroes("7FG40000+")).toEqual(true);
      expect(plusCodeHasTrailingZeroes("7F000000+")).toEqual(true);
    });
  });

  describe("isPlusCodeBetweenTwoPlusCodes()", () => {
    it("returns true for the same plus code three times", () => {
      expect(
        isPlusCodeBetweenTwoPlusCodes("7FG49Q00+", "7FG49Q00+", "7FG49Q00+"),
      ).toEqual(true);
    });

    it("returns true when the target is in between the corners", () => {
      expect(
        isPlusCodeBetweenTwoPlusCodes("9F5G2G5Q+", "9F4F8QP5+", "9F4GP647+"),
      ).toEqual(true);
    });

    it("returns false when the target is outside the corners", () => {
      expect(
        isPlusCodeBetweenTwoPlusCodes("9F5G2G5Q+", "9F4F8QP5+", "8FVC9G8F+"),
      ).toBe(false);
    });
  });

  describe("getAllChildPlusCodes()", () => {
    it("returns 400 child plus codes for a 6-digit code", () => {
      const children = getAllChildPlusCodes("7FG49Q00+");
      expect(children).toHaveLength(400);
      expect(children[0]).toBe("7FG49Q22+");
      expect(children[children.length - 1]).toBe("7FG49QXX+");
    });

    it("rejects codes that do not identify a parent area", () => {
      expect(() => getAllChildPlusCodes("9F4MGCG4+")).toThrow(
        "#g4qh7N-invalid-plus-code",
      );
    });
  });

  it("looks up map layers and builds external event links", () => {
    const hitchwiki = getMapLayer("hitchwiki");
    const linkedEvent = eventWith({
      tags: [["linkPath", "/places/berlin"]],
    }).event;

    expect(hitchwiki).toBe(MAP_LAYERS.hitchwiki);
    expect(getMapLayer()).toBeUndefined();
    expect(getMapLayer("missing")).toBeUndefined();
    expect(getEventLinkUrl(linkedEvent, hitchwiki)).toBe(
      "https://hitchwiki.org/places/berlin",
    );
    expect(getEventLinkUrl(linkedEvent)).toBeUndefined();
    expect(getEventLinkUrl(eventWith().event, hitchwiki)).toBeUndefined();
  });

  it("converts between regions and padded map boundaries", () => {
    const boundaries = regionToBoundingBox({
      latitude: 10,
      longitude: 20,
      latitudeDelta: 2,
      longitudeDelta: 4,
    });

    expect(boundaries).toEqual({
      northEast: { latitude: 12, longitude: 23 },
      southWest: { latitude: 8, longitude: 17 },
    });
    expect(boundariesToRegion(boundaries)).toEqual({
      latitude: 10,
      longitude: 20,
      latitudeDelta: 4,
      longitudeDelta: 6,
    });
  });

  it("compares plus-code precision", () => {
    expect(arePlusCodesTheSameLength("9F4G0000+", "8FVC0000+")).toBe(true);
    expect(arePlusCodesTheSameLength("9F4MGCG4+", "8FVC9G8F+")).toBe(true);
    expect(arePlusCodesTheSameLength("9F4G0000+", "9F4MGCG4+")).toBe(false);
    expect(arePlusCodesTheSameLength("9F4G0000+", "9F4MG000+")).toBe(false);
  });

  it.each([2, 4, 6, 8] as const)(
    "enumerates plus-code cells at precision %s",
    (length) => {
      const codes = getAllPlusCodesBetweenTwoPlusCodes(
        "9F4MGCG4+",
        "9F4MGCG4+",
        length,
      );

      expect(codes.length).toBeGreaterThan(0);
      expect(codes.every(isValidPlusCode)).toBe(true);
    },
  );

  it("rejects overlong boundaries", () => {
    expect(() =>
      getAllPlusCodesBetweenTwoPlusCodes("9F4MGCG4+5X", "9F4MGCG4+", 8),
    ).toThrow("#w2RUhg-plus-code-too-long");
  });

  it("separates exact, child, and unrelated map events", () => {
    const exact = eventWith({ plusCode: "9F4G0000+" });
    const child = eventWith({ plusCode: "9F4G9Q00+" });
    const unrelated = eventWith({ plusCode: "8FVC0000+" });

    expect(
      filterEventsForPlusCode([exact, child, unrelated], "9F4G0000+"),
    ).toEqual({
      eventsForPlusCodeExactly: [exact],
      eventsWithinPlusCode: [child],
    });
  });

  it("identifies configured layers and falls back for unknown events", () => {
    expect(
      getLayerForEvent(
        eventWith({
          kind: MAP_LAYERS.hitchwiki.kind,
          pubkey: MAP_LAYERS.hitchwiki.pubkey,
        }).event,
      ),
    ).toBe("hitchwiki");
    expect(getLayerForEvent(eventWith().event)).toBe("unverified");
    expect(getLayerForEvent(eventWith({ kind: 1 }).event)).toBe("trustroots");
  });
});
