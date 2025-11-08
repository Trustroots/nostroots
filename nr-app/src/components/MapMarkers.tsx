import {
  filterForMapLayerConfig,
  getTrustrootsMapFilter,
} from "@/common/utils";
import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import {
  animateToCoordinate,
  mapActions,
  mapSelectors,
} from "@/redux/slices/map.slice";
import { rootLogger } from "@/utils/logger.utils";
import { allPlusCodesForRegion } from "@/utils/map.utils";
import { createSelector } from "@reduxjs/toolkit";
import { MAP_LAYER_KEY, MAP_LAYERS } from "@trustroots/nr-common";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { matchFilter } from "nostr-tools";
import { Fragment, useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import MapView, {
  BoundingBox,
  Details,
  LongPressEvent,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps";
import { mapRefService } from "../utils/mapRef";
import { MapNoteMarker } from "./MapNoteMarker";
// @ts-ignore
import { Colors } from "@/constants/Colors";
import { getCurrentLocation } from "@/utils/location";
import { FontAwesome } from "@expo/vector-icons";

const log = rootLogger.extend("MapMarkers");

const selectEventsForLayers = createSelector(
  [eventsSelectors.selectAll, mapSelectors.selectEnabledLayerKeys],
  (
    allEvents: EventWithMetadata[],
    activeLayers: MAP_LAYER_KEY[],
  ): Record<string, EventWithMetadata[]> => {
    const trustrootsEvents = allEvents.filter((event) =>
      matchFilter(getTrustrootsMapFilter(), event.event),
    );
    const layerEvents = activeLayers.map(
      (layerKey): [MAP_LAYER_KEY, EventWithMetadata[]] => {
        const layerConfig = MAP_LAYERS[layerKey];
        const filter = filterForMapLayerConfig(layerConfig);
        const events = allEvents.filter((event) =>
          matchFilter(filter, event.event),
        );
        return [layerKey, events];
      },
    );
    const entries: [string, EventWithMetadata[]][] = [
      ["trustroots", trustrootsEvents],
      ...layerEvents,
    ];
    const output = Object.fromEntries(entries);
    return output;
  },
);

function boundariesToRegion(boundaries: BoundingBox): Region {
  const { northEast, southWest } = boundaries;
  const latitudeDelta = northEast.latitude - southWest.latitude;
  const longitudeDelta = northEast.longitude - southWest.longitude;

  const middlePoint = {
    latitude: southWest.latitude + latitudeDelta / 2,
    longitude: southWest.longitude + longitudeDelta / 2,
    latitudeDelta,
    longitudeDelta,
  };

  return middlePoint;
}

export default function MapMarkers() {
  const eventsForLayers = useAppSelector(selectEventsForLayers) as Record<
    string,
    EventWithMetadata[]
  >;
  const dispatch = useAppDispatch();
  const centerMapOnCurrentLocation = useAppSelector(
    mapSelectors.selectCenterMapOnCurrentLocation,
  );
  const currentMapLocation = useAppSelector(
    mapSelectors.selectCurrentMapLocation,
  );
  const mapViewRef = useRef<MapView | null>(null);

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
          0.0922,
          0.0421,
          1000,
        ),
      );
      // Clear the flag
      dispatch(mapActions.centerMapOnCurrentLocationComplete());
    }
  }, [centerMapOnCurrentLocation, currentMapLocation, dispatch]);

  const handleMapLongPress = useMemo(
    () =>
      function handleLongPressHandler(event: LongPressEvent) {
        dispatch(mapActions.setSelectedLatLng(event.nativeEvent.coordinate));
        dispatch(mapActions.openAddNoteModal());
      },
    [dispatch],
  );

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
          0.0922,
          0.0421,
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
        const visiblePlusCodes = allPlusCodesForRegion(region);
        dispatch(setVisiblePlusCodes(visiblePlusCodes));
      },
    [dispatch],
  );

  // Set initial region - use saved location or default to a world view
  const initialRegion: Region =
    currentMapLocation &&
    typeof currentMapLocation === "object" &&
    "latitude" in currentMapLocation &&
    "longitude" in currentMapLocation &&
    typeof currentMapLocation.latitude === "number" &&
    typeof currentMapLocation.longitude === "number"
      ? {
          latitude: currentMapLocation.latitude,
          longitude: currentMapLocation.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }
      : {
          latitude: 37.78825, // Default to San Francisco
          longitude: -122.4324,
          latitudeDelta: 50, // Zoomed out to show more of the world
          longitudeDelta: 50,
        };

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        rotateEnabled={false}
        pitchEnabled={false}
        onLongPress={handleMapLongPress}
        onRegionChangeComplete={handleMapRegionChange}
        // only use google maps on android dev and prod builds
        provider={
          Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
          Platform.OS !== "android"
            ? PROVIDER_DEFAULT
            : PROVIDER_GOOGLE
        }
        ref={mapViewRef}
        onMapReady={async () => {
          if (mapViewRef.current === null) {
            log.error("#SHtaWM mapViewRef is null");
            return;
          }
          // Register the map ref with the service for Redux sagas to use
          mapRefService.setMapRef(mapViewRef.current);

          const boundaries = await mapViewRef.current.getMapBoundaries();
          log.debug("#iztRxR onMapReady", boundaries);
          const region = boundariesToRegion(boundaries);
          handleMapRegionChange(region, {} as Details);
        }}
      >
        {Object.keys(eventsForLayers).map((layerKey) => (
          <Fragment key={layerKey}>
            {eventsForLayers[layerKey].map((event: EventWithMetadata) => (
              <MapNoteMarker
                event={event}
                key={event.event.id}
                layerKey={layerKey as MAP_LAYER_KEY}
              />
            ))}
          </Fragment>
        ))}
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
