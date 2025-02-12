import {
  addOpenLocationCodePrefixToFilter,
  filterForMapLayerConfig,
  filterForMapLayerConfigForPlusCodePrefixes,
  getTrustrootsMapFilter,
} from "@/common/utils";
import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import {
  allPlusCodesForRegion,
  getEventLinkUrl,
  isValidPlusCode,
  plusCodeToCoordinates,
  plusCodeToRectangle,
} from "@/utils/map.utils";
import { MAP_LAYER_KEY, MAP_LAYERS } from "@common/constants";
import { matchFilter } from "nostr-tools";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Button, StyleSheet, Switch, Text, View } from "react-native";
import MapView, {
  Details,
  LongPressEvent,
  Marker,
  Polygon,
  Region,
} from "react-native-maps";
import { MapNoteMarker } from "./MapNoteMarker";
import { O, F } from "@mobily/ts-belt";
import { flat } from "@mobily/ts-belt/dist/types/Array";
import { createSelectorCreator, lruMemoize } from "@reduxjs/toolkit";
import { getFirstLabelValueFromEvent } from "@common/utils";

const createSelector = createSelectorCreator(lruMemoize, F.equals);

const dummyMarkerData = [
  {
    coordinates: { latitude: 51.3045, longitude: 4.958 },
  },
  {
    coordinates: { latitude: 51.55275, longitude: 4.57075 },
  },
  {
    coordinates: { latitude: 52.06475, longitude: 4.951125 },
  },
  {
    coordinates: { latitude: 51.90499999999999, longitude: 4.91525 },
  },
  {
    coordinates: { latitude: 52.1885, longitude: 4.8115 },
  },
  {
    coordinates: { latitude: 48.874875, longitude: 3.037875 },
  },
  {
    coordinates: { latitude: 52.62625, longitude: 10.732875 },
  },
  {
    coordinates: { latitude: 52, longitude: 11 },
  },
  {
    coordinates: { latitude: 50, longitude: 11 },
  },
];

const selectEventsForLayers = createSelector(
  [
    eventsSelectors.selectAll,
    mapSelectors.selectEnabledLayerKeys,
    mapSelectors.selectVisiblePlusCodes,
  ],
  (allEvents, activeLayers, visiblePlusCodes) => {
    const trustrootsFilter = addOpenLocationCodePrefixToFilter(
      getTrustrootsMapFilter(),
      visiblePlusCodes,
    );

    const events = allEvents.reduce<
      {
        layerKey: string;
        eventWithMetadata: EventWithMetadata;
      }[]
    >((output, event) => {
      if (matchFilter(trustrootsFilter, event.event)) {
        return output.concat({
          layerKey: "trustroots", // TODO: Replace this with a constant
          eventWithMetadata: event,
        });
      }

      for (const layerKey of activeLayers) {
        const layerConfig = MAP_LAYERS[layerKey];
        const useVisiblePlusCodesInFilter = false;
        const filter = useVisiblePlusCodesInFilter
          ? filterForMapLayerConfigForPlusCodePrefixes(
              layerConfig,
              visiblePlusCodes,
            )
          : filterForMapLayerConfig(layerConfig);
        if (matchFilter(filter, event.event)) {
          return output.concat({
            layerKey,
            eventWithMetadata: event,
          });
        }
      }

      return output;
    }, []);

    const output = events.map(({ layerKey, eventWithMetadata }) => {
      const plusCode = getFirstLabelValueFromEvent(
        eventWithMetadata.event,
        "open-location-code",
      );

      if (typeof plusCode === "undefined" || !isValidPlusCode(plusCode)) {
        console.log(
          "#9k8qKM skipping event with missing / invalid plusCode",
          JSON.stringify({ plusCode, event }),
        );
        return null;
      }

      const coordinates = plusCodeToCoordinates(plusCode);

      const rectangleCoordinates = plusCodeToRectangle(plusCode);

      const layerConfig = MAP_LAYERS[layerKey];

      const url = getEventLinkUrl(eventWithMetadata.event, layerConfig);

      const pinColor = layerConfig?.markerColor || "red";
      const rectangleColor = layerConfig?.rectangleColor || "rgba(255,0,0,0.5)";

      const description = "Description for a marker";

      return {
        layerKey,
        eventWithMetadata,
        coordinates,
        rectangleCoordinates,
        url,
        pinColor,
        rectangleColor,
        description,
      };
    });

    const filteredOutput = output.filter((e) => e !== null);

    console.log(`#maoF7c selectEventsForLayers() ${filteredOutput.length}`);

    return filteredOutput;

    /*
    const trustrootsEvents = allEvents.filter((event) =>
      matchFilter(trustrootsMapFilter(), event.event),
    );
    const layerEvents = activeLayers.map(
      (layerKey): [MAP_LAYER_KEY, EventWithMetadata[]] => {
        const layerConfig = MAP_LAYERS[layerKey];
        const filter = filterForMapLayerConfigForPlusCodePrefixes(
          layerConfig,
          visiblePlusCodes,
        );
        console.log(`#FWCwyY selectEventsForLayers`, filter);
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
    const flattenedOutput = Object.keys(output).flatMap((layerKey) =>
      output[layerKey].map((event) => ({
        layerKey,
        event,
      })),
    );
    return flattenedOutput;
    */
  },
);

export function MapMarkers() {
  const events = useAppSelector(selectEventsForLayers);
  const enabledLayers = useAppSelector(mapSelectors.selectEnabledLayers);
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
        console.log("#rIMmxg Map move completed", region, details);
        const visiblePlusCodes = allPlusCodesForRegion(region);
        dispatch(setVisiblePlusCodes(visiblePlusCodes));
      },
    [dispatch],
  );

  const [hideDummyData, setHideDummyData] = useState(false);
  const [d1, sd1] = useState(true);
  const [d2, sd2] = useState(false);
  const [d3, sd3] = useState(true);

  const [showHitchwiki, setShowHitchwiki] = useState(false);

  useEffect(() => {
    setInterval(() => {
      console.log("#HWpLs8 Toggling dummy data");
      setHideDummyData((currentState) => !currentState);
    }, 3e3);
    //   setTimeout(() => {
    //     console.log("#aeGbrd Hide dummy data");
    //     setHideDummyData(true);
    //   }, 3e3);
    //   setTimeout(() => {
    //     console.log("#hkx4EC Show dummy data");
    //     setHideDummyData(false);
    //   }, 7e3);
    //   setTimeout(() => {
    //     console.log("#CzXN49 Hide dummy data again");
    //     setHideDummyData(true);
    //   }, 30e3);
  }, []);

  // console.log(
  //   `#iNicG9 MapMarkers / render() ${Date.now()}`,
  //   events.length,
  //   events,
  // );

  const hitchwikiEvents = useMemo(() => {
    const hitchwikiEvents = events.filter((v) => v.layerKey === "hitchwiki");
    console.log(`#pVD1Dj hitchwikiEvents ${hitchwikiEvents.length}`, events[0]);
    return hitchwikiEvents;
  }, [events]);

  return (
    <Fragment>
      <MapView
        style={styles.map}
        rotateEnabled={false}
        pitchEnabled={false}
        onLongPress={handleMapLongPress}
        onRegionChangeComplete={handleMapRegionChange}
      >
        <Marker
          coordinate={{ latitude: 52, longitude: 13 }}
          title="A hard coded test marker that should be removed soon"
          pinColor="indigo"
        />

        {hideDummyData
          ? null
          : dummyMarkerData.map(({ coordinates }, i) => (
              <Fragment key={i}>
                <Marker coordinate={coordinates} pinColor="red" />
              </Fragment>
            ))}

        {d1 && (
          <Marker
            coordinate={{ latitude: 52, longitude: 12 }}
            pinColor="green"
          />
        )}
        {d2 && (
          <Marker
            coordinate={{ latitude: 51, longitude: 12 }}
            pinColor="brown"
          />
        )}
        {d3 && (
          <Marker
            coordinate={{ latitude: 50, longitude: 12 }}
            pinColor="yellow"
          />
        )}

        {/* {events.map(
          ({ eventWithMetadata, coordinates, pinColor, description }) => (
            <Marker
              key={`marker-${eventWithMetadata.event.id}`}
              coordinate={coordinates}
              pinColor={pinColor}
              description={description}
            />
          ),
        )} */}

        {showHitchwiki &&
          hitchwikiEvents.map(
            ({ eventWithMetadata, coordinates, pinColor, description }) => (
              <Marker
                key={`marker-${eventWithMetadata.event.id}`}
                coordinate={coordinates}
                pinColor={pinColor}
                description={description}
              />
            ),
          )}

        {/*
      {events.map(
        ({ eventWithMetadata, rectangleCoordinates, rectangleColor }) => (
          <Polygon
            key={`polygon-${eventWithMetadata.event.id}`}
            coordinates={rectangleCoordinates}
            fillColor={rectangleColor}
            strokeColor="rgba(0, 0, 0, 0.5)" // Semi-transparent black
            strokeWidth={2}
          />
        ),
      )}
      */}
      </MapView>
      <View
        style={{
          position: "absolute",
          top: 40,
          right: 10,
          zIndex: 1,
          backgroundColor: "white",
        }}
      >
        <Button
          title="1"
          onPress={() => {
            sd1((v) => !v);
          }}
        />
        <Button
          title="2"
          onPress={() => {
            sd2((v) => !v);
          }}
        />
        <Button
          title="3"
          onPress={() => {
            sd3((v) => !v);
          }}
        />
        <Button
          title="d"
          onPress={() => {
            setHideDummyData((v) => !v);
          }}
        />
        <Switch
          value={showHitchwiki}
          onValueChange={() => void setShowHitchwiki((v) => !v)}
        />
      </View>
    </Fragment>
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
  layerToggle: {
    backgroundColor: "rgba(255, 255, 0, 0.7)",
  },
});
