declare module "open-location-code" {
  interface CodeArea {
    latitudeLo: number;
    longitudeLo: number;
    latitudeHi: number;
    longitudeHi: number;
    codeLength: number;
    latitudeCenter: number;
    longitudeCenter: number;
  }

  function encode(
    latitude: number,
    longitude: number,
    codeLength?: number
  ): string;

  function decode(code: string): CodeArea;

  function isFull(code: string): boolean;

  function isShort(code: string): boolean;

  function isValid(code: string): boolean;

  function recoverNearest(
    shortCode: string,
    referenceLatitude: number,
    referenceLongitude: number
  ): string;

  function shorten(
    code: string,
    latitude: number,
    longitude: number
  ): string;
}
