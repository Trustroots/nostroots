import type { CameraRef, MapRef } from "@maplibre/maplibre-react-native";
import { MapViewport } from "@/utils/map.utils";
import { rootLogger } from "./logger.utils";

const log = rootLogger.extend("mapRef");

/**
 * Map ref service - allows Redux sagas and other parts of the app
 * to control the map without storing the ref directly in Redux state.
 *
 * @example
 * // In a Redux saga:
 * import { mapRefService } from '@/utils/mapRef';
 *
 * function* mySaga() {
 *   mapRefService.animateCamera({
 *     center: { latitude: 37.78825, longitude: -122.4324 },
 *     zoom: 10,
 *   });
 * }
 */
class MapRefService {
  private cameraRef: CameraRef | null = null;
  private mapRef: MapRef | null = null;

  /**
   * Register the map and camera refs - called from MapLibreMapView once the
   * map is ready, and with nulls on unmount.
   */
  setRefs(map: MapRef | null, camera: CameraRef | null = null) {
    this.mapRef = map;
    this.cameraRef = camera;
    if (map) {
      log.debug("#mapRefSet Map ref registered");
    } else {
      log.debug("#mapRefUnset Map ref unregistered");
    }
  }

  /**
   * Move the camera directly in MapLibre terms.
   */
  animateCamera(
    camera: { center: { latitude: number; longitude: number }; zoom?: number },
    duration?: number,
  ) {
    if (!this.cameraRef) {
      log.warn("#noMapRef Cannot animate camera - camera ref not set");
      return;
    }
    log.debug("#animateCamera", camera);
    this.cameraRef.flyTo({
      center: [camera.center.longitude, camera.center.latitude],
      zoom: camera.zoom,
      duration,
    });
  }

  /**
   * Get current map boundaries
   */
  async getMapBoundaries() {
    if (!this.mapRef) {
      log.warn("#noMapRef Cannot get boundaries - map ref not set");
      return null;
    }
    const [west, south, east, north] = await this.mapRef.getBounds();
    return {
      northEast: { latitude: north, longitude: east },
      southWest: { latitude: south, longitude: west },
    };
  }

  /**
   * Get current center/zoom/bounds in MapLibre-native terms.
   */
  async getMapViewport(): Promise<MapViewport | null> {
    if (!this.mapRef) {
      log.warn("#noMapRef Cannot get viewport - map ref not set");
      return null;
    }

    const [center, zoom, bounds] = await Promise.all([
      this.mapRef.getCenter(),
      this.mapRef.getZoom(),
      this.mapRef.getBounds(),
    ]);

    const [west, south, east, north] = bounds;
    return {
      center: {
        latitude: center[1],
        longitude: center[0],
      },
      zoom,
      boundingBox: {
        northEast: { latitude: north, longitude: east },
        southWest: { latitude: south, longitude: west },
      },
    };
  }
}

// Export a singleton instance
export const mapRefService = new MapRefService();
