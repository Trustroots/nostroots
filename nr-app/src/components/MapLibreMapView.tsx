import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import {
  eventsToGeoJSON,
  MapGeoJSON,
  PlusCodeMarkerProperties,
  zoomToPlusCodeLength,
} from "@/utils/maplibre.utils";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
} from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NativeSyntheticEvent,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
// @ts-ignore
import { getCurrentLocation } from "@/utils/location";
import { Colors } from "@/constants/Colors";
import { FontAwesome } from "@expo/vector-icons";
import { RootState } from "@/redux/store";

import type { CameraRef } from "@maplibre/maplibre-react-native";

const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const GEOJSON_UPDATE_DEBOUNCE_MS = 500;

// ── Selectors ──────────────────────────────────────────────────────────────

const selectEventsForMapLibre = (state: RootState) =>
  mapSelectors.selectEventsForSelectedMapLayer(state);

const selectAllProfiles = (state: RootState) => state.profiles.byPubkey;

// ── Layer styles ──────────────────────────────────────────────────────────

const markerCirclePaint = {
  circleRadius: [
    "interpolate",
    ["linear"],
    ["get", "count"],
    1, 12,
    5, 18,
    20, 26,
  ],
  circleColor: "#0d9488",
  circleStrokeWidth: 3,
  circleStrokeColor: "#ffffff",
  circleOpacity: 0.9,
};

const markerCountLayout = {
  textField: "{count}",
  textSize: 12,
  textFont: ["Noto Sans Bold"],
  textAllowOverlap: true,
};

const markerCountPaint = {
  textColor: "#ffffff",
};

const markerLabelLayout = {
  textField: "{intentLabel}",
  textSize: 10,
  textFont: ["Noto Sans Regular"],
  textAllowOverlap: true,
  textIgnorePlacement: true,
  textOffset: [0, 2.5],
};

const markerLabelPaint = {
  textColor: "#0d9488",
  textHaloColor: "#ffffff",
  textHaloWidth: 1,
};

// ── Component ──────────────────────────────────────────────────────────────

export default function MapLibreMapView() {
  const dispatch = useAppDispatch();
  const events = useAppSelector(selectEventsForMapLibre);
  const profilesByPubkey = useAppSelector(selectAllProfiles);
  const savedRegion = useAppSelector(mapSelectors.selectSavedRegion);
  const cameraRef = useRef<CameraRef>(null);
  const [currentZoom, setCurrentZoom] = useState(5);

  const plusCodeLength = useMemo(
    () => zoomToPlusCodeLength(currentZoom),
    [currentZoom],
  );

  const [geoJSON, setGeoJSON] = useState<MapGeoJSON>({
    type: "FeatureCollection",
    features: [],
  });

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setGeoJSON(eventsToGeoJSON(events, profilesByPubkey, plusCodeLength));
    }, GEOJSON_UPDATE_DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [events, profilesByPubkey, plusCodeLength]);

  const defaultCenter = useMemo(() => {
    if (savedRegion) {
      return [savedRegion.longitude, savedRegion.latitude] as [number, number];
    }
    return [10.0, 48.0] as [number, number];
  }, [savedRegion]);

  const defaultZoom = useMemo(() => {
    if (savedRegion) {
      const delta = savedRegion.latitudeDelta;
      if (delta > 40) return 2;
      if (delta > 20) return 4;
      if (delta > 5) return 6;
      if (delta > 1) return 8;
      if (delta > 0.1) return 11;
      return 13;
    }
    return 5;
  }, [savedRegion]);

  const handlePress = useCallback(
    (e: NativeSyntheticEvent<{ features: GeoJSON.Feature[] }>) => {
      const feature = e?.nativeEvent?.features?.[0];
      if (!feature) return;
      const plusCode = (feature.properties as PlusCodeMarkerProperties)
        ?.plusCode;
      if (plusCode) {
        dispatch(mapActions.setSelectedPlusCode(plusCode));
      }
    },
    [dispatch],
  );

  const handleRegionDidChange = useCallback(
    (e: NativeSyntheticEvent<{ zoom: number }>) => {
      const zoom = e?.nativeEvent?.zoom;
      if (zoom != null) {
        setCurrentZoom(zoom);
      }
    },
    [],
  );

  const handleLocationPress = useCallback(async () => {
    const location = await getCurrentLocation();
    if (location) {
      dispatch(
        mapActions.setCurrentMapLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }),
      );
      cameraRef.current?.flyTo({
        center: [location.coords.longitude, location.coords.latitude],
        zoom: 12,
        duration: 1000,
      });
    }
  }, [dispatch]);

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={OPENFREEMAP_STYLE_URL}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={true}
        rotateEnabled={false}
        pitchEnabled={false}
        onRegionDidChange={handleRegionDidChange}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: defaultCenter,
            zoomLevel: defaultZoom,
          }}
        />

        <GeoJSONSource id="events-source" data={geoJSON} onPress={handlePress}>
          {/* Marker circles — size scales with event count */}
          <Layer
            id="marker-circles"
            type="circle"
            paint={markerCirclePaint}
          />

          {/* Event count inside the circle */}
          <Layer
            id="marker-count"
            type="symbol"
            layout={markerCountLayout}
            paint={markerCountPaint}
          />

          {/* Intent label below the circle */}
          <Layer
            id="marker-label"
            type="symbol"
            layout={markerLabelLayout}
            paint={markerLabelPaint}
          />
        </GeoJSONSource>
      </Map>

      <TouchableOpacity
        style={styles.locationButton}
        onPress={handleLocationPress}
      >
        <FontAwesome
          name="location-arrow"
          size={22}
          color={Colors.light.tint}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  locationButton: {
    position: "absolute",
    bottom: 30,
    right: 30,
    backgroundColor: "white",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 5,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
