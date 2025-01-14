import { isPlusCode } from "@trustroots/nr-common";

const plusCodeTestData: [string, number, number, number, number, number][] = [
  ["7FG49Q00+", 6, 20.35, 2.75, 20.4, 2.8],
  ["7FG49QCJ+2V", 10, 20.37, 2.782125, 20.370125, 2.78225],
  ["7FG49QCJ+2VX", 11, 20.3701, 2.78221875, 20.370125, 2.78225],
  ["7FG49QCJ+2VXGJ", 13, 20.370113, 2.782234375, 20.370114, 2.78223632813],
  ["8FVC2222+22", 10, 47.0, 8.0, 47.000125, 8.000125],
  ["4VCPPQGP+Q9", 10, -41.273125, 174.785875, -41.273, 174.786],
  ["62G20000+", 4, 0.0, -180.0, 1, -179],
  ["22220000+", 4, -90, -180, -89, -179],
  ["7FG40000+", 4, 20.0, 2.0, 21.0, 3.0],
  ["22222222+22", 10, -90.0, -180.0, -89.999875, -179.999875],
  ["6VGX0000+", 4, 0, 179, 1, 180],
  ["6FH32222+222", 11, 1, 1, 1.000025, 1.00003125],
  ["CFX30000+", 4, 89, 1, 90, 2],
  ["CFX30000+", 4, 89, 1, 90, 2],
  ["62H20000+", 4, 1, -180, 2, -179],
  ["62H30000+", 4, 1, -179, 2, -178],
  ["CFX3X2X2+X2", 10, 89.999875, 1, 90, 1.000125],
  [
    "6FH56C22+22",
    10,
    1.2000000000000028,
    3.4000000000000057,
    1.2001249999999999,
    3.4001250000000027,
  ],
  [
    "849VGJQF+VX7QR3J",
    15,
    37.53966912,
    -122.3750698242,
    37.53966916,
    -122.3750697021,
  ],
  [
    "849VGJQF+VX7QR3J7QR3J",
    15,
    37.53966912,
    -122.3750698242,
    37.53966916,
    -122.3750697021,
  ],
];

describe("nr-common/utils", () => {
  describe("isPlusCode()", () => {
    describe("accepts all valid plus codes", () => {
      plusCodeTestData.forEach(([plusCode]) => {
        it(`accepts ${plusCode}`, () => {
          expect(isPlusCode(plusCode)).toEqual(true);
        });
      });
    });

    describe("rejects plus codes with zeroes and trailing chars", () => {
      const invalidCodes = [
        "7FG49Q00+2",
        "7FG49Q00+2V",
        "7FG49Q00+2VX",
        "7FG49Q00+2VXGJ",
        "7FG49Q00+VX7QR3J7QR3J",
        "7FG40000+2V",
        "7FG40000+2VX",
        "7FG40000+2VXGJ",
        "7FG40000+VX7QR3J7QR3J",
        "7F000000+2V",
        "7F000000+2VX",
        "7F000000+2VXGJ",
        "7F000000+VX7QR3J7QR3J",
        "849VGJ00+VX7QR3J7QR3J",
      ];
      invalidCodes.forEach((code) => {
        it(`rejects ${code}`, () => {
          expect(isPlusCode(code)).toEqual(false);
        });
      });
    });

    describe("rejects plus codes with a single character after the plus", () => {
      const invalidCodes = ["7FG49QCJ+2"];
      invalidCodes.forEach((code) => {
        it(`rejects ${code}`, () => {
          expect(isPlusCode(code)).toEqual(false);
        });
      });
    });

    describe("rejects codes with leading zeroes", () => {
      const invalidCodes = [
        "00G49Q00+2",
        "00G49Q00+2V",
        "00G49Q00+2VX",
        "00G49Q00+2VXGJ",
        "00G49Q00+VX7QR3J7QR3J",
        "00G40000+2V",
        "00G40000+2VX",
        "00G40000+2VXGJ",
        "00G40000+VX7QR3J7QR3J",
        "00000000+2V",
        "00000000+2VX",
        "00000000+2VXGJ",
        "00000000+VX7QR3J7QR3J",
        "009VGJ00+VX7QR3J7QR3J",
      ];

      invalidCodes.forEach((code) => {
        it(`rejects ${code}`, () => {
          expect(isPlusCode(code)).toEqual(false);
        });
      });
    });
  });
});
