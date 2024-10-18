import {
  allPlusCodesForRegion,
  plusCodeToCoordinates,
} from "@/utils/map.utils";
import { StyleSheet, Text, View } from "react-native";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import MapView, { Callout, LatLng, Marker } from "react-native-maps";

import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import React, { useState } from "react";
import { Button, Modal, TextInput } from "react-native";

const NoteMarker = ({ event }: { event: EventWithMetadata }) => {
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
  const dispatch = useAppDispatch();

  const handleAddNote = () => {
    // Logic to add the note to the event or state
    console.log("Note added:", note, "at", selectedCoordinate);
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
