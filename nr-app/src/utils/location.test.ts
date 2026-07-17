import * as Location from "expo-location";
import { getCurrentLocation } from "./location";

describe("location", () => {
  it("returns null when permission is denied", async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(
      {
        status: "denied",
      },
    );

    await expect(getCurrentLocation()).resolves.toBeNull();
  });

  it("returns current position when permission is granted", async () => {
    const location = {
      coords: {
        latitude: 52.52,
        longitude: 13.405,
      },
    };
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(
      {
        status: "granted",
      },
    );
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(location);

    await expect(getCurrentLocation()).resolves.toBe(location);
  });
});
