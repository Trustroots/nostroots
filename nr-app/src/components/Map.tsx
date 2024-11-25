import { FlatList, StyleSheet, Switch, Text, View } from "react-native";

import { publishNotePromiseAction } from "@/redux/actions/publish.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { coordinatesToPlusCode } from "@/utils/map.utils";
import { MAP_LAYER_KEY, MAP_LAYERS, MapLayer } from "@common/constants";
import React, { useMemo, useState } from "react";
import { Button, Modal, TextInput } from "react-native";
import Toast from "react-native-root-toast";
import { MapMarkers } from "./MapMarkers";

export default function Map() {
  const enabledLayers = useAppSelector(mapSelectors.selectEnabledLayers);
  const selectedCoordinate = useAppSelector(mapSelectors.selectSelectedLatLng);
  const isAddNoteModalOpen = useAppSelector(
    mapSelectors.selectIsAddNoteModalOpen,
  );
  const dispatch = useAppDispatch();

  const [noteContent, setNoteContent] = useState("");

  const closeModal = useMemo(
    () => () => dispatch(mapActions.closeAddNoteModal()),
    [dispatch],
  );

  const handleAddNote = useMemo(
    () =>
      async function handleAddNoteHandler() {
        if (selectedCoordinate === undefined) {
          console.warn(
            "#BerlDy Trying to add note without selectedCoordinate.",
          );
          return;
        }

        const plusCode = coordinatesToPlusCode(selectedCoordinate);
        console.log(
          "#a9vi49v handleNoteAdd()",
          noteContent,
          "at",
          selectedCoordinate,
          plusCode,
          "plusCode not very precise",
        );

        try {
          await dispatch(publishNotePromiseAction(noteContent, plusCode));
        } catch (error) {
          Toast.show(
            `Error: #dxmsa3 ${error instanceof Error ? error.message : "unknown"}`,
            {
              duration: Toast.durations.LONG,
              position: Toast.positions.TOP,
            },
          );
        }

        dispatch(mapActions.closeAddNoteModal());
      },
    [selectedCoordinate, noteContent, dispatch],
  );

  console.log("#iNicG9 Map.tsx / render()", Date.now());

  return (
    <View style={styles.mapContainer}>
      <MapMarkers />
      <View style={styles.toggleWrapper}>
        <FlatList
          data={Object.entries(MAP_LAYERS) as [MAP_LAYER_KEY, MapLayer][]}
          keyExtractor={([key]) => key}
          renderItem={({ item: [key, config] }) => (
            <View style={styles.toggleContainer}>
              <Switch
                value={enabledLayers[key]}
                onValueChange={() => void dispatch(mapActions.toggleLayer(key))}
              />
              <Text>{config.title} </Text>
            </View>
          )}
        />
      </View>

      <Modal
        visible={isAddNoteModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModal}
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
            value={noteContent}
            onChangeText={setNoteContent}
            onSubmitEditing={handleAddNote}
          />
          <Button title="Add Note" onPress={handleAddNote} />
          <Button title="Cancel" onPress={closeModal} />
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
