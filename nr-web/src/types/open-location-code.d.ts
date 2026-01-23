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

  class OpenLocationCode {
    encode(
      latitude: number,
      longitude: number,
      codeLength?: number
    ): string;

    decode(code: string): CodeArea;

    isFull(code: string): boolean;

    isShort(code: string): boolean;

    isValid(code: string): boolean;

    recoverNearest(
      shortCode: string,
      referenceLatitude: number,
      referenceLongitude: number
    ): string;

    shorten(
      code: string,
      latitude: number,
      longitude: number
    ): string;
  }

  export { OpenLocationCode };
}
