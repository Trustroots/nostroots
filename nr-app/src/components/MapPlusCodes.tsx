import { getMapProvider } from "@/constants/Map";
import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  animateToCoordinate,
  mapActions,
  mapSelectors,
} from "@/redux/slices/map.slice";
import { rootLogger } from "@/utils/logger.utils";
import {
  allPlusCodesForRegion,
  boundariesToRegion,
  coordinatesToPlusCode,
  filterEventsForPlusCode,
  getAllPlusCodesBetweenTwoPlusCodes,
  plusCodeToRectangle,
  regionToBoundingBox,
} from "@/utils/map.utils";
import { mapRefService } from "@/utils/mapRef";
import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import MapView, { Details, Polygon, Region } from "react-native-maps";
// @ts-ignore
import { getCurrentLocation } from "@/utils/location";
import { FontAwesome } from "@expo/vector-icons";
import { createSelector } from "reselect";

import { Colors } from "@/constants/Colors";

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

const selectPlusCodesWithState = createSelector(
  [
    mapSelectors.selectEventsForSelectedMapLayer,
    mapSelectors.selectBoundingBox,
  ],
  (events: any, boundingBox: any) => {
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

    const output = plusCodes.map((plusCode) => {
      const { eventsForPlusCodeExactly, eventsWithinPlusCode } =
        filterEventsForPlusCode(events, plusCode);
      return {
        plusCode,
        eventCountForThisPlusCodeExactly: eventsForPlusCodeExactly.length,
        eventCountWithinThisPlusCode: eventsWithinPlusCode.length,
      };
    });
    return output;
  },
);

export default function MapPlusCodes() {
  const dispatch = useAppDispatch();

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

  const mapViewRef = useRef<MapView>(null);

  // Clean up the map ref on unmount
  useEffect(() => {
    return () => {
      mapRefService.setMapRef(null);
    };
  }, []);

  // Handle centering map on current location when flag is set
  useEffect(() => {
    if (
      centerMapOnCurrentLocation &&
      currentMapLocation &&
      typeof currentMapLocation === "object" &&
      "latitude" in currentMapLocation &&
      "longitude" in currentMapLocation &&
      typeof currentMapLocation.latitude === "number" &&
      typeof currentMapLocation.longitude === "number"
    ) {
      // Use the new action-based approach
      dispatch(
        animateToCoordinate(
          currentMapLocation.latitude,
          currentMapLocation.longitude,
          0.1844,
          0.0842,
          1000,
        ),
      );
      // Clear the flag
      dispatch(mapActions.centerMapOnCurrentLocationComplete());
    }
  }, [centerMapOnCurrentLocation, currentMapLocation, dispatch]);

  // Handle centering map for half modal
  useEffect(() => {
    if (
      centerMapOnHalfModal &&
      currentMapLocation &&
      typeof currentMapLocation === "object" &&
      "latitude" in currentMapLocation &&
      "longitude" in currentMapLocation &&
      typeof currentMapLocation.latitude === "number" &&
      typeof currentMapLocation.longitude === "number"
    ) {
      // Adjust center point for half modal
      const adjustedLatitude = currentMapLocation.latitude - 0.02; // Adjust as needed
      dispatch(
        animateToCoordinate(
          adjustedLatitude,
          currentMapLocation.longitude,
          0.1844,
          0.0842,
          1000,
        ),
      );
      // Clear the flag
      dispatch(mapActions.centerMapOnHalfModalComplete());
    }
  }, [centerMapOnHalfModal, currentMapLocation, dispatch]);

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
      function handleMapRegionChangeHandler(region: Region, details: Details) {
        __DEV__ && console.log("#rIMmxg Map move completed", region, details);
        const boundingBox = regionToBoundingBox(region);
        dispatch(mapActions.setBoundingBox(boundingBox));
        const visiblePlusCodes = allPlusCodesForRegion(region);
        dispatch(setVisiblePlusCodes(visiblePlusCodes));
        const length = whatLengthOfPlusCodeToShow(region);
        log.debug("#mzWdGm regionChange plusCode length", length);
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
        provider={getMapProvider()}
        onMapReady={async (event) => {
          if (mapViewRef.current === null) {
            log.error("#SHtaWM mapViewRef is null");
            return;
          }
          // Register the map ref with the service for Redux sagas to use
          mapRefService.setMapRef(mapViewRef.current);

          const boundaries = await mapViewRef.current.getMapBoundaries();
          log.debug("#iztRxR onMapReady", boundaries);
          const region = boundariesToRegion(boundaries);
          handleMapRegionChange(region, {});
        }}
      >
        {true &&
          (plusCodesWithState as any[]).map(
            (plusCodeWithState: any, index: any) => {
              const isSelected =
                selectedPlusCode?.startsWith(plusCodeWithState.plusCode) ||
                plusCodeWithState.plusCode.startsWith(selectedPlusCode ?? "");
              const shouldShowSelected = isMapModalOpen && isSelected;
              return (
                <Polygon
                  key={index}
                  coordinates={plusCodeToRectangle(plusCodeWithState.plusCode)}
                  fillColor={
                    shouldShowSelected
                      ? "rgba(0, 90, 120, 0.6)" // Darker teal tint for selected cell
                      : `rgba(${Math.min(255, (plusCodeWithState.eventCountForThisPlusCodeExactly + plusCodeWithState.eventCountWithinThisPlusCode) * 60).toString()}, 0, 0, 0.6)`
                  }
                  strokeColor="rgba(0, 0, 0, 0.5)"
                  strokeWidth={2}
                  tappable={true}
                  onPress={() => {
                    dispatch(
                      mapActions.setSelectedPlusCode(
                        plusCodeWithState.plusCode,
                      ),
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
