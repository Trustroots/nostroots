import { getMapProvider } from "@/constants/Map";
import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  animateToCoordinate,
  mapActions,
  mapSelectors,
} from "@/redux/slices/map.slice";
import { eventsSelectors } from "@/redux/slices/events.slice";
import { metricsSelectors } from "@/redux/slices/metrics.slice";
import { RootState } from "@/redux/store";
import { rootLogger } from "@/utils/logger.utils";
import {
  allPlusCodesForRegion,
  boundariesToRegion,
  coordinatesToPlusCode,
  getAllPlusCodesBetweenTwoPlusCodes,
  plusCodeToRectangle,
  regionToBoundingBox,
} from "@/utils/map.utils";
import { isEventWithinThisPlusCode } from "@/utils/event.utils";
import { isTimestampRecent } from "@/utils/time.utils";
import { mapRefService } from "@/utils/mapRef";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import MapView, { Polygon, Region } from "react-native-maps";
// @ts-ignore
import { getCurrentLocation } from "@/utils/location";
import { FontAwesome } from "@expo/vector-icons";
import { createSelector } from "reselect";

import { Colors } from "@/constants/Colors";

const PULSE_INTERVAL_MS = 2000;
const PULSE_ALPHA_LOW = 0.3;
const PULSE_ALPHA_HIGH = 0.7;
const RECENT_ACTIVITY_HOURS = 3;

// TODO - Only show if a plus code has direct notes, child notes, or no notes

const log = rootLogger.extend("MapPlusCodes");

function whatLengthOfPlusCodeToShow(region: Region) {
  const factor = 1.6;
  if (region.latitudeDelta > 20 * factor) {
    return 2;
  } else if (region.latitudeDelta > 1 * factor) {
    return 4;
  } else if (region.latitudeDelta > 0.05 * factor) {
    return 6;
  }
  return 8;
}

const selectRootState = (state: RootState) => state;

const selectPlusCodesWithState = createSelector(
  [mapSelectors.selectBoundingBox, selectRootState],
  (boundingBox: any, rootState: RootState) => {
    if (typeof boundingBox === "undefined") {
      return [];
    }

    const length = whatLengthOfPlusCodeToShow(boundariesToRegion(boundingBox));

    const southWest = coordinatesToPlusCode({
      ...boundingBox.southWest,
      length,
    });
    const northEast = coordinatesToPlusCode({
      ...boundingBox.northEast,
      length,
    });

    // const plusCodes = [southWest, northEast];
    const plusCodes = getAllPlusCodesBetweenTwoPlusCodes(
      southWest,
      northEast,
      length,
    );

    const allEvents = eventsSelectors.selectAll(rootState);

    const output = plusCodes.map((plusCode) => {
      const messagesMetricCount =
        metricsSelectors.selectMessagesMetricByPlusCode(rootState, plusCode);

      const isRecentlyActive = allEvents.some(
        (ewm) =>
          isEventWithinThisPlusCode(ewm.event, plusCode) &&
          isTimestampRecent(ewm.event.created_at, RECENT_ACTIVITY_HOURS),
      );

      return {
        plusCode,
        heatCount: messagesMetricCount,
        isRecentlyActive,
      };
    });
    return output;
  },
);

function usePulseAlpha(): number {
  const [pulseHigh, setPulseHigh] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseHigh((prev) => !prev);
    }, PULSE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return pulseHigh ? PULSE_ALPHA_HIGH : PULSE_ALPHA_LOW;
}

export default function MapPlusCodes() {
  const dispatch = useAppDispatch();
  const [isMapReady, setIsMapReady] = useState(false);
  const pulseAlpha = usePulseAlpha();

  const plusCodesWithState = useAppSelector(selectPlusCodesWithState);
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
  const savedRegion = useAppSelector(mapSelectors.selectSavedRegion);

  const mapViewRef = useRef<MapView>(null);

  // Clean up the map ref on unmount
  useEffect(() => {
    return () => {
      mapRefService.setMapRef(null);
    };
  }, []);

  // Handle centering map on current location when flag is set
  useEffect(() => {
    if (isMapReady && centerMapOnCurrentLocation && currentMapLocation) {
      dispatch(
        animateToCoordinate(
          currentMapLocation.latitude,
          currentMapLocation.longitude,
          0.1844,
          0.0842,
          1000,
        ),
      );
      dispatch(mapActions.centerMapOnCurrentLocationComplete());
    }
  }, [isMapReady, centerMapOnCurrentLocation, currentMapLocation, dispatch]);

  // Handle centering map for half modal
  useEffect(() => {
    if (isMapReady && centerMapOnHalfModal && currentMapLocation) {
      // Adjust center point for half modal
      const adjustedLatitude = currentMapLocation.latitude - 0.02;
      dispatch(
        animateToCoordinate(
          adjustedLatitude,
          currentMapLocation.longitude,
          0.1844,
          0.0842,
          1000,
        ),
      );
      dispatch(mapActions.centerMapOnHalfModalComplete());
    }
  }, [isMapReady, centerMapOnHalfModal, currentMapLocation, dispatch]);

  const handleLocationPress = async () => {
    const location = await getCurrentLocation();
    if (location) {
      dispatch(
        mapActions.setCurrentMapLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }),
      );
      dispatch(
        animateToCoordinate(
          location.coords.latitude,
          location.coords.longitude,
          0.1844,
          0.0842,
          1000,
        ),
      );
      dispatch(mapActions.centerMapOnCurrentLocationComplete());
    }
  };

  const handleMapRegionChange = useMemo(
    () =>
      function handleMapRegionChangeHandler(region: Region) {
        const boundingBox = regionToBoundingBox(region);
        dispatch(mapActions.setBoundingBox(boundingBox));
        const visiblePlusCodes = allPlusCodesForRegion(region);
        dispatch(setVisiblePlusCodes(visiblePlusCodes));
        const length = whatLengthOfPlusCodeToShow(region);
        log.debug("#mzWdGm regionChange plusCode length", length);
        // Save the region so it can be restored when the app reopens
        dispatch(mapActions.setSavedRegion(region));
      },
    [dispatch],
  );

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapViewRef}
        style={styles.map}
        rotateEnabled={false}
        pitchEnabled={false}
        onRegionChangeComplete={handleMapRegionChange}
        initialRegion={savedRegion}
        provider={getMapProvider()}
        onMapReady={async () => {
          if (mapViewRef.current === null) {
            log.error("#SHtaWM mapViewRef is null");
            return;
          }
          // Register the map ref with the service for Redux sagas to use
          mapRefService.setMapRef(mapViewRef.current);
          setIsMapReady(true);

          const boundaries = await mapViewRef.current.getMapBoundaries();
          log.debug("#iztRxR onMapReady", boundaries);
          const region = boundariesToRegion(boundaries);
          handleMapRegionChange(region);
        }}
      >
        {(plusCodesWithState as any[]).map(
          (plusCodeWithState: any, index: any) => {
            const isSelected =
              selectedPlusCode?.startsWith(plusCodeWithState.plusCode) ||
              plusCodeWithState.plusCode.startsWith(selectedPlusCode ?? "");
            const shouldShowSelected = isMapModalOpen && isSelected;
            const alpha = plusCodeWithState.isRecentlyActive ? pulseAlpha : 0.6;
            return (
              <Polygon
                key={index}
                coordinates={plusCodeToRectangle(plusCodeWithState.plusCode)}
                fillColor={
                  shouldShowSelected
                    ? `rgba(0, 90, 120, ${alpha})` // Darker teal tint for selected cell
                    : `rgba(${Math.min(255, plusCodeWithState.heatCount * 60).toString()}, 0, 0, ${alpha})`
                }
                strokeColor="rgba(0, 0, 0, 0.5)"
                strokeWidth={2}
                tappable={true}
                onPress={() => {
                  dispatch(
                    mapActions.setSelectedPlusCode(plusCodeWithState.plusCode),
                  );
                }}
              />
            );
          },
        )}
      </MapView>
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
  mapContainer: {
    flex: 1,
  },
  toggleWrapper: { position: "absolute", top: 40, left: 10, zIndex: 1 },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  input: {
    width: 200,
    padding: 10,
    backgroundColor: "white",
    marginBottom: 10,
  },
  marker: {
    width: 200,
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
