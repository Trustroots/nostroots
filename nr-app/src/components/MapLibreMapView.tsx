import { useColorScheme } from "@/hooks/useColorScheme";
import { useThemeColors } from "@/hooks/useThemeColors";
import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { metricsSelectors } from "@/redux/slices/metrics.slice";
import { RootState } from "@/redux/store";
import { rootLogger } from "@/utils/logger.utils";
import {
  allPlusCodesForBoundingBox,
  coordinatesToPlusCode,
  getAllPlusCodesBetweenTwoPlusCodes,
} from "@/utils/map.utils";
import {
  GridGeoJSON,
  GridLineGeoJSON,
  gridPlusCodeForLngLat,
  latitudeDeltaToZoom,
  PlusCodeGridCell,
  plusCodeGridLinesToGeoJSON,
  plusCodeGridToGeoJSON,
  zoomToPlusCodeLength,
} from "@/utils/maplibre.utils";
import { mapRefService } from "@/utils/mapRef";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  UserLocation,
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
import { FontAwesome } from "@expo/vector-icons";
import { createSelector } from "reselect";

import type {
  CameraRef,
  FillLayerSpecification,
  LineLayerSpecification,
  MapRef,
  PressEventWithFeatures,
} from "@maplibre/maplibre-react-native";
import type { PlusCodeShortLength } from "@/utils/map.utils";

const LIGHT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const RECENTER_ZOOM = 10;
const RECENTER_DURATION_MS = 1000;

const log = rootLogger.extend("MapLibreMapView");

// ── Selectors ──────────────────────────────────────────────────────────────

const selectRootState = (state: RootState) => state;

/**
 * The precision the grid is currently drawn at. Tap handling reads the same
 * value so a press always resolves to a cell the user can actually see.
 */
const selectGridPlusCodeLength = createSelector(
  [mapSelectors.selectBoundingBox],
  (boundingBox): PlusCodeShortLength | undefined => {
    if (typeof boundingBox === "undefined") {
      return undefined;
    }

    const latitudeDelta =
      boundingBox.northEast.latitude - boundingBox.southWest.latitude;
    // Keep grid precision one step conservative so it does not jump to a
    // finer level too early while zooming in.
    const effectiveZoom = latitudeDeltaToZoom(latitudeDelta) - 1;
    return zoomToPlusCodeLength(effectiveZoom);
  },
);

/**
 * The plus code cells covering the visible bounding box at the precision the
 * current zoom calls for.
 */
const selectVisibleGridPlusCodes = createSelector(
  [mapSelectors.selectBoundingBox, selectGridPlusCodeLength],
  (boundingBox, length): string[] => {
    if (typeof boundingBox === "undefined" || typeof length === "undefined") {
      return [];
    }

    const southWest = coordinatesToPlusCode({
      ...boundingBox.southWest,
      length,
    });
    const northEast = coordinatesToPlusCode({
      ...boundingBox.northEast,
      length,
    });

    return getAllPlusCodesBetweenTwoPlusCodes(southWest, northEast, length);
  },
);

/**
 * Heat cells for the visible grid. This runs after visible cells are known so
 * we can draw grid lines independent of note/metric availability.
 */
const selectVisibleGridHeatCells = createSelector(
  [selectVisibleGridPlusCodes, selectRootState],
  (visiblePlusCodes, rootState): PlusCodeGridCell[] => {
    return visiblePlusCodes.map((plusCode) => ({
      plusCode,
      heatCount: metricsSelectors.selectMessagesMetricByPlusCode(
        rootState,
        plusCode,
      ),
    }));
  },
);

// ── Layer styles ──────────────────────────────────────────────────────────

/**
 * Red heat ramp by message count, teal for the selected cell — matching the
 * polygon colours the plus code grid has always used.
 */
const gridFillPaint: FillLayerSpecification["paint"] = {
  "fill-color": [
    "case",
    ["get", "selected"],
    "rgba(0, 90, 120, 0.6)",
    [
      "interpolate",
      ["linear"],
      ["get", "heatCount"],
      0,
      "rgba(0, 0, 0, 0)",
      1,
      "rgba(60, 0, 0, 0.6)",
      4,
      "rgba(255, 0, 0, 0.6)",
    ],
  ],
};

// ── Component ──────────────────────────────────────────────────────────────

export default function MapLibreMapView() {
  const dispatch = useAppDispatch();
  const boundingBox = useAppSelector(mapSelectors.selectBoundingBox);
  const gridHeatCells = useAppSelector(selectVisibleGridHeatCells);
  const gridPlusCodeLength = useAppSelector(selectGridPlusCodeLength);
  const selectedPlusCode = useAppSelector(mapSelectors.selectSelectedPlusCode);
  const isMapModalOpen = useAppSelector(mapSelectors.selectIsMapModalOpen);
  const centerMapOnCurrentLocation = useAppSelector(
    mapSelectors.selectCenterMapOnCurrentLocation,
  );
  const centerMapOnHalfModal = useAppSelector(
    mapSelectors.selectCenterMapOnHalfModal,
  );
  const currentMapLocation = useAppSelector(
    mapSelectors.selectCurrentMapLocation,
  );
  const savedViewport = useAppSelector(mapSelectors.selectSavedViewport);

  const colors = useThemeColors();
  const isDark = useColorScheme() === "dark";

  const gridLinePaint = useMemo<LineLayerSpecification["paint"]>(
    () => ({
      "line-color": isDark ? "rgba(255, 255, 255, 0.55)" : "rgba(0, 0, 0, 0.5)",
      "line-width": 1,
    }),
    [isDark],
  );

  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const heatGeoJSON = useMemo<GridGeoJSON>(
    () =>
      plusCodeGridToGeoJSON(
        gridHeatCells,
        isMapModalOpen ? selectedPlusCode : undefined,
      ),
    [gridHeatCells, selectedPlusCode, isMapModalOpen],
  );
  const gridLineGeoJSON = useMemo<GridLineGeoJSON>(
    () => plusCodeGridLinesToGeoJSON(boundingBox, gridPlusCodeLength),
    [boundingBox, gridPlusCodeLength],
  );

  // Release the map ref on unmount so sagas don't animate a dead map
  useEffect(() => {
    return () => {
      mapRefService.setRefs(null, null);
    };
  }, []);

  useEffect(() => {
    if (isMapReady && centerMapOnCurrentLocation && currentMapLocation) {
      mapRefService.animateCamera(
        {
          center: {
            latitude: currentMapLocation.latitude,
            longitude: currentMapLocation.longitude,
          },
          zoom: RECENTER_ZOOM,
        },
        RECENTER_DURATION_MS,
      );
      dispatch(mapActions.centerMapOnCurrentLocationComplete());
    }
  }, [isMapReady, centerMapOnCurrentLocation, currentMapLocation, dispatch]);

  useEffect(() => {
    if (!isMapReady) {
      return;
    }

    // Camera ref can be assigned slightly after map-ready callback.
    mapRefService.setRefs(mapRef.current, cameraRef.current);
  }, [isMapReady]);

  useEffect(() => {
    if (isMapReady && centerMapOnHalfModal && currentMapLocation) {
      // Shift the centre up so the half modal doesn't cover the target
      mapRefService.animateCamera(
        {
          center: {
            latitude: currentMapLocation.latitude - 0.02,
            longitude: currentMapLocation.longitude,
          },
          zoom: RECENTER_ZOOM,
        },
        RECENTER_DURATION_MS,
      );
      dispatch(mapActions.centerMapOnHalfModalComplete());
    }
  }, [isMapReady, centerMapOnHalfModal, currentMapLocation, dispatch]);

  const defaultCenter = useMemo(
    () =>
      savedViewport
        ? ([savedViewport.center.longitude, savedViewport.center.latitude] as [
            number,
            number,
          ])
        : ([10.0, 48.0] as [number, number]),
    [savedViewport],
  );

  const defaultZoom = useMemo(() => savedViewport?.zoom ?? 5, [savedViewport]);

  /**
   * Publish the visible area to Redux. Everything downstream — the grid
   * precision, the metrics, the modal, and session restore — reads from here.
   */
  const publishVisibleViewport = useCallback(async () => {
    const viewport = await mapRefService.getMapViewport();
    if (!viewport) return;

    dispatch(mapActions.setBoundingBox(viewport.boundingBox));
    dispatch(
      setVisiblePlusCodes(allPlusCodesForBoundingBox(viewport.boundingBox)),
    );
    dispatch(mapActions.setSavedViewport(viewport));
  }, [dispatch]);

  const handlePress = useCallback(
    (e: NativeSyntheticEvent<PressEventWithFeatures>) => {
      const lngLat = e?.nativeEvent?.lngLat;
      if (!lngLat || !gridPlusCodeLength) return;

      dispatch(
        mapActions.setSelectedPlusCode(
          gridPlusCodeForLngLat(lngLat, gridPlusCodeLength),
        ),
      );
    },
    [dispatch, gridPlusCodeLength],
  );

  const handleLocationPress = useCallback(async () => {
    const location = await getCurrentLocation();
    if (!location) {
      return;
    }

    dispatch(
      mapActions.setCurrentMapLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }),
    );
    dispatch(mapActions.centerMapOnCurrentLocation());
  }, [dispatch]);

  return (
    <View style={styles.container}>
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={isDark ? DARK_STYLE_URL : LIGHT_STYLE_URL}
        logo={false}
        attribution={false}
        compass={true}
        touchRotate={false}
        touchPitch={false}
        onRegionDidChange={publishVisibleViewport}
        onDidFinishLoadingMap={() => {
          mapRefService.setRefs(mapRef.current, cameraRef.current);
          setIsMapReady(true);
          log.debug("#iztRxR map ready");
          publishVisibleViewport();
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: defaultCenter, zoom: defaultZoom }}
        />

        <GeoJSONSource
          id="grid-heat-source"
          data={heatGeoJSON}
          onPress={handlePress}
        >
          <Layer id="grid-fill" type="fill" paint={gridFillPaint} />
        </GeoJSONSource>

        <GeoJSONSource id="grid-outline-source" data={gridLineGeoJSON}>
          <Layer id="grid-outline" type="line" paint={gridLinePaint} />
        </GeoJSONSource>

        {currentMapLocation && <UserLocation />}
      </Map>

      <TouchableOpacity
        style={[styles.locationButton, { backgroundColor: colors.card }]}
        onPress={handleLocationPress}
      >
        <FontAwesome name="location-arrow" size={22} color={colors.primary} />
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
