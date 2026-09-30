import type { CameraRef, MapRef } from "@maplibre/maplibre-react-native";

import { mapRefService } from "./mapRef";

function registerCamera() {
  const camera = { flyTo: jest.fn() } as unknown as CameraRef;
  mapRefService.setRefs({} as MapRef, camera);
  return camera;
}

describe("mapRefService.animateCamera", () => {
  afterEach(() => mapRefService.setRefs(null, null));

  it("passes padding through so the target centres in the visible area", () => {
    const camera = registerCamera();

    mapRefService.animateCamera(
      {
        center: { latitude: 52.5, longitude: 13.4 },
        zoom: 10,
        padding: { bottom: 400 },
      },
      1000,
    );

    expect(camera.flyTo).toHaveBeenCalledWith({
      center: [13.4, 52.5],
      zoom: 10,
      padding: { top: 0, right: 0, bottom: 400, left: 0 },
      duration: 1000,
    });
  });

  it("resets padding when none is given, so an earlier offset doesn't stick", () => {
    const camera = registerCamera();

    mapRefService.animateCamera({ center: { latitude: 1, longitude: 2 } });

    expect(camera.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      }),
    );
  });
});
