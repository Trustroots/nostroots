import {
  allPlusCodesForRegion,
  coordinatesToPlusCode,
  plusCodeToCoordinates,
} from "@/utils/map.utils";
import { StyleSheet, Text, View, Switch } from "react-native";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import MapView, { Callout, LatLng, Marker } from "react-native-maps";

import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import React, { useState } from "react";
import { Button, Modal, TextInput } from "react-native";
<<<<<<< HEAD
import { getFirstTagValueFromEvent } from "@/common/utils";
=======

// todo: make it more typescriptsy
function extractLocationCode(data: any) {
  for (const entry of data) {
    if (Array.isArray(entry) && entry.length >= 3) {
      if (entry[0] === "l" && entry[2] === "open-location-code") {
        return entry[1];
      }
    }
  }
  return null;
}
>>>>>>> 2b75bee (adding hitchmap switch to ux, not functional yet)

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
  const [isHitchmapEnabled, setIsHitchmapEnabled] = useState(true);

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
      <View style={styles.toggleContainer}>
        <Text>Hitchmap</Text>
        <Switch
          value={isHitchmapEnabled}
          onValueChange={setIsHitchmapEnabled}
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
  toggleContainer: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 1, // Ensure toggle is above the map
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
