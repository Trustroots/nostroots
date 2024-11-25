import {
  allPlusCodesForRegion,
  coordinatesToPlusCode,
  plusCodeToCoordinates,
  plusCodeToRectangle,
  isValidPlusCode,
} from "@/utils/map.utils";
import {
  FlatList,
  Linking,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import urlJoin from "url-join";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import MapView, { Callout, LatLng, Marker, Polygon } from "react-native-maps";
import Toast from "react-native-root-toast";

import { filterForMapLayerConfig, trustrootsMapFilter } from "@/common/utils";
import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import { publishNotePromiseAction } from "@/redux/actions/publish.actions";
import { mapSelectors, toggleLayer } from "@/redux/slices/map.slice";
import { MAP_LAYER_KEY, MAP_LAYERS, MapLayer } from "@common/constants";
import {
  getFirstLabelValueFromEvent,
  getFirstTagValueFromEvent,
  // isPlusCode,
} from "@common/utils";
import { createSelector } from "@reduxjs/toolkit";
import { matchFilter, NostrEvent } from "nostr-tools";
import React, { useState } from "react";
import { Button, Modal, TextInput } from "react-native";

const selectEventsForLayers = createSelector(
  [eventsSelectors.selectAll, mapSelectors.selectEnabledLayerKeys],
  (allEvents, activeLayers) => {
    const trustrootsEvents = allEvents.filter((event) =>
      matchFilter(trustrootsMapFilter(), event.event),
    );
    const layerEvents = activeLayers.map(
      (layerKey): [MAP_LAYER_KEY, EventWithMetadata[]] => {
        const layerConfig = MAP_LAYERS[layerKey];
        const filter = filterForMapLayerConfig(layerConfig);
        console.log("RETLIF", filter);
        const events = allEvents.filter((event) =>
          matchFilter(filter, event.event),
        );
        console.log("STNEVE", events);
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

function getMapLayer(layerKey?: string) {
  if (typeof layerKey === "undefined" || !(layerKey in MAP_LAYERS)) {
    return;
  }
  return MAP_LAYERS[layerKey as MAP_LAYER_KEY];
}

function getEventLinkUrl(event: NostrEvent, layerConfig?: MapLayer) {
  if (typeof layerConfig === "undefined") {
    return;
  }
  const linkPath = getFirstTagValueFromEvent(event, "linkPath");
  if (typeof linkPath === "undefined") {
    return;
  }
  const linkBaseUrl = layerConfig.rootUrl;
  const url = urlJoin(linkBaseUrl, linkPath);
  return url;
}

const NoteMarker = ({
  event,
  layerKey,
}: {
  event: EventWithMetadata;
  layerKey?: string;
}) => {
  const plusCode = getFirstLabelValueFromEvent(
    event.event,
    "open-location-code",
  );

  if (typeof plusCode === "undefined" || !isValidPlusCode(plusCode)) {
    console.log(
      "#9k8qKM skipping event with missing / invalid plusCode",
      JSON.stringify({ plusCode, event }),
    );
    return null;
  }

  const layerConfig = getMapLayer(layerKey);
  const coordinates = plusCodeToCoordinates(plusCode);
  const rectangleCoordinates = plusCodeToRectangle(plusCode);

  const url = getEventLinkUrl(event.event, layerConfig);

  const pinColor = layerConfig?.markerColor || "red";
  const rectangleColor = layerConfig?.rectangleColor || "rgba(255,0,0,0.5)";

  return (
    <View>
      <Marker coordinate={coordinates} pinColor={pinColor}>
        <Callout
          onPress={() => {
            if (typeof url !== "undefined") {
              Linking.openURL(url);
            }
          }}
        >
          <View style={styles.marker}>
            <Text>
              {`${new Date(event.event.created_at * 1000).toLocaleString()} ${event.event.content} `}
              <Text style={{ color: "blue" }}>{url}</Text>
              <Text>{plusCode || null}</Text>
            </Text>
          </View>
        </Callout>
      </Marker>
      <Polygon
        coordinates={rectangleCoordinates}
        fillColor={rectangleColor}
        strokeColor="rgba(0, 0, 0, 0.5)" // Semi-transparent black
        strokeWidth={2}
      />
    </View>
  );
};

export default function Map() {
  const enabledLayers = useAppSelector(mapSelectors.selectEnabledLayers);
  const eventsForLayers = useAppSelector(selectEventsForLayers);
  const dispatch = useAppDispatch();

  const handleAddNote = async () => {
    if (selectedCoordinate === undefined) {
      console.warn("Trying to add note without selectedCoordinate.'=");
      return;
    }
    // Logic to add the note to the event or state
    const plusCode = coordinatesToPlusCode(selectedCoordinate);
    console.log(
      "#a9vi49v Note added:",
      note,
      "at",
      selectedCoordinate,
      plusCode,
      "plusCode not very precise",
    );

    try {
      await dispatch(publishNotePromiseAction(note, plusCode));
    } catch (error) {
      Toast.show(
        `Error: #dxmsa3 ${error instanceof Error ? error.message : "unknown"}`,
        {
          duration: Toast.durations.LONG,
          position: Toast.positions.TOP,
        },
      );
    }

    setModalVisible(false);
    setNote("");
  };

  const [modalVisible, setModalVisible] = useState(false);
  const [note, setNote] = useState("");
  const [selectedCoordinate, setSelectedCoordinate] = useState<LatLng>();

  return (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.map}
        rotateEnabled={false}
        pitchEnabled={false}
        onLongPress={(event) => {
          setSelectedCoordinate(event.nativeEvent.coordinate);
          setModalVisible(true);
        }}
        onRegionChangeComplete={(region, details) => {
          console.log("#rIMmxg Map move completed", region, details);
          const visiblePlusCodes = allPlusCodesForRegion(region);
          dispatch(setVisiblePlusCodes(visiblePlusCodes));
        }}
      >
        <Marker
          coordinate={{ latitude: 52, longitude: 13 }}
          title="A marker"
          pinColor="indigo"
        />

        {Object.entries(eventsForLayers).map(([layerKey, events]) => (
          <View key={layerKey}>
            {events.map((event) => (
              <NoteMarker
                event={event}
                key={event.event.id}
                layerKey={layerKey}
              />
            ))}
          </View>
        ))}
      </MapView>
      <View style={styles.toggleWrapper}>
        <FlatList
          data={Object.entries(MAP_LAYERS) as [MAP_LAYER_KEY, MapLayer][]}
          keyExtractor={([key]) => key}
          renderItem={({ item: [key, config] }) => (
            <View style={styles.toggleContainer}>
              <Switch
                value={enabledLayers[key]}
                onValueChange={() => void dispatch(toggleLayer(key))}
              />
              <Text>{config.title} </Text>
            </View>
          )}
        />
      </View>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TextInput
            ref={(input) => {
              if (input) {
                input.focus();
              }
            }}
            style={styles.input}
            placeholder="Enter your note"
            value={note}
            onChangeText={setNote}
            onSubmitEditing={handleAddNote}
          />
          <Button title="Add Note" onPress={handleAddNote} />
          <Button title="Cancel" onPress={() => setModalVisible(false)} />
        </View>
      </Modal>
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
});
