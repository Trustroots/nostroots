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
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { allPlusCodesForRegion } from "@/utils/map.utils";
import { MAP_LAYER_KEY, MAP_LAYERS } from "@trustroots/nr-common";
import { createSelector } from "@reduxjs/toolkit";
import { matchFilter } from "nostr-tools";
import { Fragment, useMemo } from "react";
import { Platform, StyleSheet } from "react-native";
import MapView, {
  Details,
  LongPressEvent,
  Marker,
  Region,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
} from "react-native-maps";
import { MapNoteMarker } from "./MapNoteMarker";
import Constants, { ExecutionEnvironment } from "expo-constants";

const selectEventsForLayers = createSelector(
  [eventsSelectors.selectAll, mapSelectors.selectEnabledLayerKeys],
  (allEvents, activeLayers) => {
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

export function MapMarkers() {
  const eventsForLayers = useAppSelector(selectEventsForLayers);
  const dispatch = useAppDispatch();

  const handleMapLongPress = useMemo(
    () =>
      function handleLongPressHandler(event: LongPressEvent) {
        dispatch(mapActions.setSelectedLatLng(event.nativeEvent.coordinate));
        dispatch(mapActions.openAddNoteModal());
      },
    [dispatch],
  );
  const handleMapRegionChange = useMemo(
    () =>
      function handleMapRegionChangeHandler(region: Region, details: Details) {
        __DEV__ && console.log("#rIMmxg Map move completed", region, details);
        const visiblePlusCodes = allPlusCodesForRegion(region);
        dispatch(setVisiblePlusCodes(visiblePlusCodes));
      },
    [dispatch],
  );

  return (
    <MapView
      style={styles.map}
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
    >
      <Marker
        coordinate={{ latitude: 52, longitude: 13 }}
        title="A hard coded test marker that should be removed soon"
        pinColor="indigo"
      />

      {Object.entries(eventsForLayers).map(([layerKey, events]) => (
        <Fragment key={layerKey}>
          {events.map((event) => (
            <MapNoteMarker
              event={event}
              key={event.event.id}
              layerKey={layerKey}
            />
          ))}
        </Fragment>
      ))}
    </MapView>
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
});
