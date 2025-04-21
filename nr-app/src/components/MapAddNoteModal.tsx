import { publishNotePromiseAction } from "@/redux/actions/publish.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { coordinatesToPlusCode } from "@/utils/map.utils";
import { Picker } from "@react-native-picker/picker";
import { getCurrentTimestamp } from "@trustroots/nr-common";
import { useMemo, useState } from "react";
import {
  Button,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-root-toast";

const MINUTE_IN_SECONDS = 60;
const HOUR_IN_SECONDS = 60 * MINUTE_IN_SECONDS;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;
const WEEK_IN_SECONDS = 7 * DAY_IN_SECONDS;
const MONTH_IN_SECONDS = 30 * DAY_IN_SECONDS;
const YEAR_IN_SECONDS = 365 * DAY_IN_SECONDS;

export default function MapAddNoteModal() {
  const dispatch = useAppDispatch();
  const selectedCoordinate = useAppSelector(mapSelectors.selectSelectedLatLng);
  const isAddNoteModalOpen = useAppSelector(
    mapSelectors.selectIsAddNoteModalOpen,
  );

  const [noteContent, setNoteContent] = useState("");
  const [noteExpiry, setNoteExpiry] = useState<string>(
    WEEK_IN_SECONDS.toString(),
  );

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

        // validate note content
        if (noteContent.length === 0) {
          // toast isnt visible with modal for some reason
          // Toast.show("Note content cannot be empty", {
          //   duration: Toast.durations.LONG,
          //   position: Toast.positions.TOP,
          // });
          return;
        }

        const expirationTimestampSeconds =
          getCurrentTimestamp() + parseInt(noteExpiry);

        const plusCode = coordinatesToPlusCode(selectedCoordinate);
        __DEV__ &&
          console.log(
            "#a9vi49v handleNoteAdd()",
            noteContent,
            "at",
            selectedCoordinate,
            plusCode,
            expirationTimestampSeconds,
            noteExpiry,
          );

        try {
          await dispatch(
            publishNotePromiseAction(
              noteContent,
              plusCode,
              expirationTimestampSeconds,
            ),
          );

          Toast.show("Note added successfully", {
            duration: Toast.durations.LONG,
            position: Toast.positions.TOP,
          });

          setNoteContent("");
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
    [selectedCoordinate, noteContent, dispatch, noteExpiry],
  );

  return (
    <Modal
      visible={isAddNoteModalOpen}
      transparent={true}
      animationType="slide"
      onRequestClose={closeModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalContainer}
      >
        <View style={styles.contentContainer}>
          <Text style={styles.inputLabel}>Add Note to Map</Text>
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
            <Picker.Item label="1 year" value={YEAR_IN_SECONDS.toString()} />
            <Picker.Item label="1 month" value={MONTH_IN_SECONDS.toString()} />
            <Picker.Item label="1 week" value={WEEK_IN_SECONDS.toString()} />
            <Picker.Item label="1 hour" value={HOUR_IN_SECONDS.toString()} />
            <Picker.Item
              label="1 minute"
              value={MINUTE_IN_SECONDS.toString()}
            />
          </Picker>
          <Button title="Add Note" onPress={handleAddNote} />
          <Button title="Cancel" onPress={closeModal} />
        </View>
      </KeyboardAvoidingView>
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
  contentContainer: {
    width: "80%",
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  layerToggle: {
    color: "rgba(255,255,255,1)",
    backgroundColor: "rgba(10, 10, 0, 0.2)",
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  input: {
    width: "100%",
    height: 80,
    padding: 10,
    backgroundColor: "white",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
  },
  marker: {
    width: 200,
  },
  picker: {
    width: "100%",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    marginBottom: 10,
  },
  pickerItem: {
    color: "black",
  },
});
