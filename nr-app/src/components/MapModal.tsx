import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { Modal, ScrollView, View } from "react-native";
import AddNoteForm from "./AddNoteForm";
import NotesList from "./NotesList";
import NotificationSubscription from "./NotificationSubscription";
import { Button } from "./ui/button";
import { Section } from "./ui/section";
import { Text } from "./ui/text";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";

export default function MapModal() {
  const dispatch = useAppDispatch();
  const showModal = useAppSelector(mapSelectors.selectIsMapModalOpen);
  const selectedPlusCode = useAppSelector(mapSelectors.selectSelectedPlusCode);
  const selectedLayer = useAppSelector(mapSelectors.selectSelectedLayer);
  const hasPrivateKeyInSecureStorage = useAppSelector(
    keystoreSelectors.selectHasPrivateKeyInSecureStorage,
  );

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

        {!hasPrivateKeyInSecureStorage ? (
          <Section>
            <Text>
              Go to settings and setup your private key to be able to post onto
              the map.
            </Text>
          </Section>
        ) : (
          <>
            {selectedLayer === "trustroots" ? (
              <AddNoteForm />
            ) : (
              <View>
                <Text>
                  Choose the trustroots layer to be able to add content
                </Text>
              </View>
            )}

            {selectedLayer !== "trustroots" ? null : (
              <Section>
                <NotificationSubscription />
              </Section>
            )}
          </>
        )}

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
