import {
  allPlusCodesForRegion,
  coordinatesToPlusCode,
  plusCodeToCoordinates,
} from "@/utils/map.utils";
import { StyleSheet, View, Text } from "react-native";

import MapView, { Marker, Callout } from "react-native-maps";
import { eventsSelectors } from "@/redux/slices/events.slice";
import { useAppSelector } from "@/redux/hooks";

import React, { useState } from "react";
import { Modal, TextInput, Button } from "react-native";

const NoteMarker = ({ event }) => {
  if (Array.isArray(event.event.tags[1]) && event.event.tags[1][1]) {
    const coordinates = plusCodeToCoordinates(event.event.tags[1][1]);
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
  } else {
    return null;
  }
};

export default function Map() {
  const events = useAppSelector(eventsSelectors.selectAll);

  const handleAddNote = () => {
    // Logic to add the note to the event or state
    console.log("Note added:", note, "at", selectedCoordinate);
    setModalVisible(false);
    setNote("");
  };

  const [modalVisible, setModalVisible] = useState(false);
  const [note, setNote] = useState("");
  const [selectedCoordinate, setSelectedCoordinate] = useState(null);
  const handleLongPress = (event) => {
    setSelectedCoordinate(event.nativeEvent.coordinate);
    setModalVisible(true);
  };

  return (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.map}
        rotateEnabled={false}
        pitchEnabled={false}
        onLongPress={handleLongPress}
        onRegionChangeComplete={(region, details) => {
          console.log("#rIMmxg Map move completed", region, details);
          const topRightCoordinates = {
            latitude: region.latitude + region.latitudeDelta,
            longitude: region.longitude + region.longitudeDelta,
          };
          const bottomLeftCoordinates = {
            latitude: region.latitude - region.latitudeDelta,
            longitude: region.longitude - region.longitudeDelta,
          };
          const topRightCode = coordinatesToPlusCode(topRightCoordinates);
          const bottomLeftCode = coordinatesToPlusCode(bottomLeftCoordinates);
          console.log(
            `#bu2PoU Bottom left is ${bottomLeftCode}, top right is ${topRightCode}`,
          );
          const parts = allPlusCodesForRegion(region);
          console.log("#fWrvAt Got parts", parts);
        }}
      >
        <Marker coordinate={{ latitude: 52, longitude: 13 }} title="A marker" />

        {events.map((event) => (
          <NoteMarker event={event} />
        ))}
      </MapView>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter your note"
            value={note}
            onChangeText={setNote}
          />
          <Button
            style={styles.button}
            title="Add Note"
            onPress={handleAddNote}
          />
          <Button
            style={styles.button}
            title="Cancel"
            onPress={() => setModalVisible(false)}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
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
  button: {},
});
