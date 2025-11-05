import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import {
  Button,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import NotesList from "./NotesList";
import AddNoteForm from "./AddNoteForm";
import { SafeAreaView } from "react-native-safe-area-context";
import { subscribeToPlusCode } from "@/redux/actions/notifications.actions";

export default function MapModal() {
  const dispatch = useAppDispatch();
  const showModal = useAppSelector(mapSelectors.selectIsMapModalOpen);
  const selectedPlusCode = useAppSelector(mapSelectors.selectSelectedPlusCode);
  const selectedLayer = useAppSelector(mapSelectors.selectSelectedLayer);

  return (
    <Modal visible={showModal}>
      <SafeAreaView>
        <ScrollView>
          <Button
            title="Close"
            onPress={() => {
              dispatch(mapActions.closeMapModal());
            }}
          />

          <View style={styles.separator} />

          <NotesList plusCode={selectedPlusCode} />

          <View style={styles.separator} />

          {selectedLayer === "trustroots" ? (
            <AddNoteForm />
          ) : (
            <View>
              <Text>Choose the trustroots layer to be able to add content</Text>
            </View>
          )}

          <View style={styles.separator} />

          <View>
            <Text>Subscribe to notifications for this plus code</Text>
            <Button
              title="Subscribe"
              onPress={() => {
                dispatch(subscribeToPlusCode(selectedPlusCode));
              }}
            />
          </View>

          <View style={styles.separator} />

          <Text>Modal is under development</Text>
          <Button
            title="Close"
            onPress={() => {
              dispatch(mapActions.closeMapModal());
            }}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  separator: {
    width: "100%",
    height: 2,
    borderColor: "black",
    borderWidth: 1,
    marginVertical: 12,
  },
});
