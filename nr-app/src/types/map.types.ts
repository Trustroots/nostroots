/**
 * Geometry types the app shares between the map view, the map slice and the
 * plus code utilities. These used to come from react-native-maps; they are
 * declared here so nothing outside the map view depends on a map library.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Region extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface BoundingBox {
  northEast: LatLng;
  southWest: LatLng;
}
