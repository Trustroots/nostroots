import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { Button, Modal, ScrollView, Text, View } from "react-native";
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
          <NotesList plusCode={selectedPlusCode} />
          {selectedLayer === "trustroots" ? (
            <AddNoteForm />
          ) : (
            <View>
              <Text>Choose the trustroots layer to be able to add content</Text>
            </View>
          )}

          <View>
            <Text>Subscribe to notifications for this plus code</Text>
            <Button
              title="Subscribe"
              onPress={() => {
                dispatch(subscribeToPlusCode(selectedPlusCode));
              }}
            />
          </View>

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
