import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { Button, Modal, Text, View } from "react-native";
import NotesList from "./NotesList";
import AddNoteForm from "./AddNoteForm";

export default function MapModal() {
  const dispatch = useAppDispatch();
  const showModal = useAppSelector(mapSelectors.selectIsMapModalOpen);
  const selectedPlusCode = useAppSelector(mapSelectors.selectSelectedPlusCode);
  const selectedLayer = useAppSelector(mapSelectors.selectSelectedLayer);

  return (
    <Modal visible={showModal}>
      <View>
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
        <Text>Modal is under development</Text>
        <Button
          title="Close"
          onPress={() => {
            dispatch(mapActions.closeMapModal());
          }}
        />
      </View>
    </Modal>
  );
}
