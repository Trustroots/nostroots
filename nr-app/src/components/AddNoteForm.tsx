import { publishNotePromiseAction } from "@/redux/actions/publish.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { getCurrentTimestamp } from "@trustroots/nr-common";
import { useMemo, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-root-toast";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const MINUTE_IN_SECONDS = 60;
const HOUR_IN_SECONDS = 60 * MINUTE_IN_SECONDS;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;
const WEEK_IN_SECONDS = 7 * DAY_IN_SECONDS;
const MONTH_IN_SECONDS = 30 * DAY_IN_SECONDS;
const YEAR_IN_SECONDS = 365 * DAY_IN_SECONDS;

const noteExpiryOptions = [
  { label: "1 year", value: YEAR_IN_SECONDS.toString() },
  { label: "1 month", value: MONTH_IN_SECONDS.toString() },
  { label: "1 week", value: WEEK_IN_SECONDS.toString() },
  { label: "1 day", value: DAY_IN_SECONDS.toString() },
  { label: "1 hour", value: HOUR_IN_SECONDS.toString() },
];

export default function AddNoteForm() {
  const dispatch = useAppDispatch();
  const selectedPlusCode = useAppSelector(mapSelectors.selectSelectedPlusCode);

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
        if (
          typeof selectedPlusCode === "undefined" ||
          selectedPlusCode.length === 0
        ) {
          Toast.show(
            "Error: Cannot add note without a selected plus code. #Rjbe0s",
            {
              duration: Toast.durations.LONG,
              position: Toast.positions.TOP,
            },
          );
        }

        // validate note content. Must be longer than 3 chars
        if (noteContent.trim().length < 3) {
          Toast.show("Note must be at least 3 characters long", {
            duration: Toast.durations.LONG,
            position: Toast.positions.TOP,
          });
          return;
        }

        const expirationTimestampSeconds =
          getCurrentTimestamp() + parseInt(noteExpiry);

        __DEV__ &&
          console.log(
            "#XmGopY handleNoteAdd()",
            noteContent,
            "at",
            selectedPlusCode,
            expirationTimestampSeconds,
            noteExpiry,
          );

        try {
          // time out after 5s
          const timeout = setTimeout(() => {
            throw new Error("Note publishing timed out.");
          }, 5000);

          await dispatch(
            await publishNotePromiseAction(
              noteContent,
              selectedPlusCode,
              expirationTimestampSeconds,
            ),
          );

          clearTimeout(timeout);

          Toast.show("Note added successfully", {
            duration: Toast.durations.LONG,
            position: Toast.positions.TOP,
          });

          setNoteContent("");
        } catch (error) {
          Toast.show(
            `Error: #3Rtob2 ${error instanceof Error ? error.message : JSON.stringify(error)}`,
            {
              duration: Toast.durations.LONG,
              position: Toast.positions.TOP,
            },
          );
        }

        dispatch(mapActions.closeAddNoteModal());
      },
    [selectedPlusCode, noteContent, dispatch, noteExpiry],
  );

  return (
    <View style={styles.contentContainer}>
      <Text style={styles.inputLabel}>Add Note to Map</Text>
      <BottomSheetTextInput
        style={styles.input}
        placeholder="Enter your note"
        value={noteContent}
        onChangeText={setNoteContent}
        onSubmitEditing={handleAddNote}
        multiline={true}
      />

      <Text>Note expiry:</Text>
      <Select
        onValueChange={(selectedOption) => {
          if (typeof selectedOption !== "undefined") {
            setNoteExpiry(selectedOption.value);
          }
        }}
        defaultValue={noteExpiryOptions[3]}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select a fruit" />
        </SelectTrigger>
        <SelectContent className="w-[180px]">
          <SelectGroup>
            <SelectLabel>Note expiry</SelectLabel>
            {noteExpiryOptions.map(({ label, value }, index) => (
              <SelectItem label={label} value={value} key={index}>
                {label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <View style={styles.buttonContainer}>
        <View style={styles.button}>
          <Button title="Add Note" onPress={handleAddNote} />
        </View>
        <View style={styles.button}>
          <Button title="Cancel" onPress={closeModal} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    width: "95%",
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
  buttonContainer: {
    width: "100%",
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
  },
  button: {
    width: "40%",
    marginHorizontal: 10,
  },
});
