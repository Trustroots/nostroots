import MapView, { Region } from "react-native-maps";
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
 *   // Animate to a specific region
 *   mapRefService.animateToRegion({
 *     latitude: 37.78825,
 *     longitude: -122.4324,
 *     latitudeDelta: 0.0922,
 *     longitudeDelta: 0.0421,
 *   });
 *
 *   // Or animate to coordinates with default zoom
 *   mapRefService.animateToCoordinate(37.78825, -122.4324);
 * }
 *
 * @example
 * // Using Redux actions (preferred):
 * import { mapActions } from '@/redux/slices/map.slice';
 *
 * // Dispatch from anywhere in the app
 * dispatch(mapActions.animateToCoordinate({
 *   latitude: 37.78825,
 *   longitude: -122.4324,
 *   duration: 1000,
 * }));
 */
class MapRefService {
  private mapRef: MapView | null = null;

  /**
   * Set the map ref - should be called from the MapMarkers component
   */
  setMapRef(ref: MapView | null) {
    this.mapRef = ref;
    if (ref) {
      log.debug("#mapRefSet Map ref registered");
    } else {
      log.debug("#mapRefUnset Map ref unregistered");
    }
  }

  /**
   * Get the map ref - for direct access if needed
   */
  getMapRef(): MapView | null {
    return this.mapRef;
  }

  /**
   * Animate the map to a specific region
   */
  animateToRegion(region: Region, duration?: number) {
    if (!this.mapRef) {
      log.warn("#noMapRef Cannot animate to region - map ref not set");
      return;
    }
    log.debug("#animateToRegion", region);
    this.mapRef.animateToRegion(region, duration);
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
      {
        latitude,
        longitude,
        latitudeDelta,
        longitudeDelta,
      },
      duration,
    );
  }

  /**
   * Animate the camera (allows more control)
   */
  animateCamera(
    camera: {
      center?: { latitude: number; longitude: number };
      pitch?: number;
      heading?: number;
      altitude?: number;
      zoom?: number;
    },
    duration?: number,
  ) {
    if (!this.mapRef) {
      log.warn("#noMapRef Cannot animate camera - map ref not set");
      return;
    }
    log.debug("#animateCamera", camera);
    this.mapRef.animateCamera(camera, { duration });
  }

  /**
   * Fit to supplied coordinates with optional padding
   */
  fitToCoordinates(
    coordinates: { latitude: number; longitude: number }[],
    options?: {
      edgePadding?: {
        top: number;
        right: number;
        bottom: number;
        left: number;
      };
      animated?: boolean;
    },
  ) {
    if (!this.mapRef) {
      log.warn("#noMapRef Cannot fit to coordinates - map ref not set");
      return;
    }
    log.debug("#fitToCoordinates", coordinates, options);
    this.mapRef.fitToCoordinates(coordinates, options);
  }

  /**
   * Get current map boundaries
   */
  async getMapBoundaries() {
    if (!this.mapRef) {
      log.warn("#noMapRef Cannot get boundaries - map ref not set");
      return null;
    }
    return await this.mapRef.getMapBoundaries();
  }
}

// Export a singleton instance
export const mapRefService = new MapRefService();
