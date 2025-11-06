import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { Modal, ScrollView, View } from "react-native";
import AddNoteForm from "./AddNoteForm";
import NotesList from "./NotesList";
import NotificationSubscription from "./NotificationSubscription";
import { Button } from "./ui/button";
import { Section } from "./ui/section";
import { Text } from "./ui/text";

export default function MapModal() {
  const dispatch = useAppDispatch();
  const showModal = useAppSelector(mapSelectors.selectIsMapModalOpen);
  const selectedPlusCode = useAppSelector(mapSelectors.selectSelectedPlusCode);
  const selectedLayer = useAppSelector(mapSelectors.selectSelectedLayer);

  return (
    <Modal visible={showModal}>
      <ScrollView contentContainerClassName="p-safe-offset-4 bg-white flex flex-col gap-2">
        <Button
          variant="outline"
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

        <Section>
          <NotificationSubscription />
        </Section>

        <Button
          variant="outline"
          title="Close"
          onPress={() => {
            dispatch(mapActions.closeMapModal());
          }}
        />
        <Text variant="muted">Modal is under development</Text>
      </ScrollView>
    </Modal>
  );
}
