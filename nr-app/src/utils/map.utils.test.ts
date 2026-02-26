import {
  getAllChildPlusCodes,
  isPlusCodeBetweenTwoPlusCodes,
  plusCodeHasTrailingZeroes,
  plusCodeToFirstFourSegments,
} from "./map.utils";

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
  });

  describe("getAllChildPlusCodes()", () => {
    it("returns 400 child plus codes for a 6-digit code", () => {
      const children = getAllChildPlusCodes("7FG49Q00+");
      expect(children).toHaveLength(400);
      expect(children[0]).toBe("7FG49Q22+");
      expect(children[children.length - 1]).toBe("7FG49QXX+");
    });
  });
});
