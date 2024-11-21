import {
  allPlusCodesForRegion,
  coordinatesToPlusCode,
  plusCodeToCoordinates,
} from "@/utils/map.utils";
import { StyleSheet, Text, View, Switch, FlatList } from "react-native";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import MapView, { Callout, LatLng, Marker } from "react-native-maps";

import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import React, { useState } from "react";
import { Button, Modal, TextInput } from "react-native";
import { getFirstTagValueFromEvent } from "@/common/utils";
import { mapSelectors, toggleLayer } from "@/redux/slices/map.slice";
import { MAP_LAYER_KEY, MAP_LAYERS, MapLayer } from "@/common/constants";

const NoteMarker = ({ event }: { event: EventWithMetadata }) => {
  const plusCode = getFirstTagValueFromEvent(event.event, "open-location-code");

  if (typeof plusCode === "undefined") {
    return null;
  }

  const coordinates = plusCodeToCoordinates(plusCode);

  return (
    <Marker coordinate={coordinates}>
      <Callout>
        <View style={{ width: 200 }}>
          <Text>
            {`${new Date(event.event.created_at * 1000).toLocaleString()} ${event.event.content}`}
          </Text>
        </View>
      </Callout>
    </Marker>
  );
};

export default function Map() {
  const events = useAppSelector(eventsSelectors.selectAll);
  const enabledLayers = useAppSelector(mapSelectors.selectEnabledLayers);
  const dispatch = useAppDispatch();

  const handleAddNote = () => {
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
        <Marker coordinate={{ latitude: 52, longitude: 13 }} title="A marker" />

        {events.map((event) => (
          <NoteMarker event={event} key={event.event.sig} />
        ))}
      </MapView>
      <View style={styles.toggleWrapper}>
        <FlatList
          data={Object.entries(MAP_LAYERS) as [MAP_LAYER_KEY, MapLayer][]}
          keyExtractor={([key]) => key}
          renderItem={({ item: [key, config] }) => (
            <View style={styles.toggleContainer}>
              <Text>{config.title}</Text>
              <Switch
                value={enabledLayers[key]}
                onValueChange={() => void dispatch(toggleLayer(key))}
              />
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
});
