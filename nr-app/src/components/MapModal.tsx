import { publishNotePromiseAction } from "@/redux/actions/publish.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { coordinatesToPlusCode } from "@/utils/map.utils";
import { Picker } from "@react-native-picker/picker";
import { useMemo, useState } from "react";
import { Button, Modal, StyleSheet, TextInput, View } from "react-native";
import Toast from "react-native-root-toast";

const MINUTE_IN_SECONDS = 60;
const HOUR_IN_SECONDS = 60 * MINUTE_IN_SECONDS;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;
const WEEK_IN_SECONDS = 7 * DAY_IN_SECONDS;
const MONTH_IN_SECONDS = 30 * DAY_IN_SECONDS;
const YEAR_IN_SECONDS = 365 * DAY_IN_SECONDS;

export default function MapModal() {
  const dispatch = useAppDispatch();
  const selectedCoordinate = useAppSelector(mapSelectors.selectSelectedLatLng);
  const isAddNoteModalOpen = useAppSelector(
    mapSelectors.selectIsAddNoteModalOpen,
  );

  const [noteContent, setNoteContent] = useState("");
  const [noteExpiry, setNoteExpiry] = useState(YEAR_IN_SECONDS);

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
        __DEV__ &&
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

  return (
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
          multiline={true}
        />
        <Picker
          selectedValue={noteExpiry}
          onValueChange={(v) => {
            setNoteExpiry(v);
          }}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          <Picker.Item label="1 year" value={YEAR_IN_SECONDS} />
          <Picker.Item label="1 week" value={WEEK_IN_SECONDS} />
          <Picker.Item label="1 month" value={MONTH_IN_SECONDS} />
          <Picker.Item label="1 week" value={WEEK_IN_SECONDS} />
          <Picker.Item label="1 hour" value={HOUR_IN_SECONDS} />
          <Picker.Item label="1 minute" value={MINUTE_IN_SECONDS} />
        </Picker>
        <Button title="Add Note" onPress={handleAddNote} />
        <Button title="Cancel" onPress={closeModal} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  layerToggle: {
    color: "rgba(255,255,255,1)",
    backgroundColor: "rgba(10, 10, 0, 0.2)",
  },
  input: {
    width: 200,
    height: 80,
    padding: 10,
    backgroundColor: "white",
    marginBottom: 10,
  },
  marker: {
    width: 200,
  },
  picker: {
    width: 200,
    backgroundColor: "white",
  },
  pickerItem: {
    color: "black",
  },
});
