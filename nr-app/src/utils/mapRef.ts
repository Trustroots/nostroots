import type { CameraRef, MapRef } from "@maplibre/maplibre-react-native";
import { Region } from "@/utils/map.utils";
import { latitudeDeltaToZoom } from "./maplibre.utils";
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
 *   mapRefService.animateToCoordinate(37.78825, -122.4324);
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
   * Animate the map to a specific region
   */
  animateToRegion(region: Region, duration?: number) {
    if (!this.cameraRef) {
      log.warn("#noMapRef Cannot animate to region - camera ref not set");
      return;
    }
    log.debug("#animateToRegion", region);
    this.cameraRef.flyTo({
      center: [region.longitude, region.latitude],
      zoom: latitudeDeltaToZoom(region.latitudeDelta),
      duration,
    });
  }

  /**
   * Animate to a specific coordinate with default zoom
   */
  animateToCoordinate(
    latitude: number,
    longitude: number,
    latitudeDelta: number = 0.0922,
    longitudeDelta: number = 0.0421,
    duration?: number,
  ) {
    this.animateToRegion(
      { latitude, longitude, latitudeDelta, longitudeDelta },
      duration,
    );
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
}

// Export a singleton instance
export const mapRefService = new MapRefService();
