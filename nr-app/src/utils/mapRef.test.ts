import type { CameraRef, MapRef } from "@maplibre/maplibre-react-native";

import { mapRefService } from "./mapRef";

function fakeCamera() {
  return { flyTo: jest.fn() } as unknown as CameraRef & {
    flyTo: jest.Mock;
  };
}

function fakeMap() {
  return {
    getCenter: jest.fn(async () => [13.4, 52.5]),
    getZoom: jest.fn(async () => 11),
    getBounds: jest.fn(async () => [13.0, 52.3, 13.8, 52.7]),
  } as unknown as MapRef;
}

describe("mapRefService", () => {
  afterEach(() => {
    mapRefService.setRefs(null);
  });

  it("does nothing without registered refs", async () => {
    expect(() =>
      mapRefService.animateCamera({ center: { latitude: 1, longitude: 2 } }),
    ).not.toThrow();
    await expect(mapRefService.getMapViewport()).resolves.toBeNull();
  });

  it("flies the camera to a MapLibre [longitude, latitude] center", () => {
    const camera = fakeCamera();
    mapRefService.setRefs(fakeMap(), camera);

    mapRefService.animateCamera(
      { center: { latitude: 52.5, longitude: 13.4 }, zoom: 9 },
      500,
    );

    expect(camera.flyTo).toHaveBeenCalledWith({
      center: [13.4, 52.5],
      zoom: 9,
      duration: 500,
    });
  });

  it("converts MapLibre center and bounds into a viewport", async () => {
    mapRefService.setRefs(fakeMap(), fakeCamera());

    await expect(mapRefService.getMapViewport()).resolves.toEqual({
      center: { latitude: 52.5, longitude: 13.4 },
      zoom: 11,
      boundingBox: {
        northEast: { latitude: 52.7, longitude: 13.8 },
        southWest: { latitude: 52.3, longitude: 13.0 },
      },
    });
  });

  it("forgets the refs when they're cleared", async () => {
    const camera = fakeCamera();
    mapRefService.setRefs(fakeMap(), camera);
    mapRefService.setRefs(null);

    mapRefService.animateCamera({ center: { latitude: 1, longitude: 2 } });

    expect(camera.flyTo).not.toHaveBeenCalled();
    await expect(mapRefService.getMapViewport()).resolves.toBeNull();
  });
});
