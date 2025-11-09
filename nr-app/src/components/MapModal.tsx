import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { RootState } from "@/redux/store";
import { useSelector } from "react-redux";

import { EventWithMetadata } from "@/redux/slices/events.slice";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
import {
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddNoteForm from "./AddNoteForm";
import NotesList from "./NotesList";
import NotificationSubscription from "./NotificationSubscription";
import { Section } from "./ui/section";
import { Text } from "./ui/text";

export default function MapModal() {
  const dispatch = useAppDispatch();
  const showModal = useAppSelector(mapSelectors.selectIsMapModalOpen);
  const selectedPlusCode = useAppSelector(
    mapSelectors.selectSelectedPlusCode,
  ) as string;

  const selectedEvent = useSelector(
    (state: RootState) => state.map.currentNotificationEvent,
  ) as EventWithMetadata | undefined;

  const selectedLayer = useAppSelector(mapSelectors.selectSelectedLayer);
  const hasPrivateKeyInSecureStorage = useAppSelector(
    keystoreSelectors.selectHasPrivateKeyInSecureStorage,
  );

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { top, bottom } = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["50%", "95%"], []);
  const bottomSheetContentStyle = useMemo(
    () => ({
      paddingTop: top + 16,
      paddingBottom: bottom + 16,
      paddingHorizontal: 16,
    }),
    [top, bottom],
  );

  useEffect(() => {
    if (showModal) {
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [showModal]);

  const handleDismiss = () => {
    if (showModal) {
      dispatch(mapActions.closeMapModal());
    }
  };

  return (
    <BottomSheetModalProvider>
      <BottomSheetModal
        ref={bottomSheetModalRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        onDismiss={handleDismiss}
        backdropComponent={() => null}
      >
        <BottomSheetScrollView
          className="grow"
          contentContainerClassName="bg-white px-safe-offset-4 pb-safe rounded-t-3xl"
        >
          <View style={styles.contentStack}>
            <NotesList
              plusCode={selectedPlusCode}
              selectedEventId={selectedEvent?.event.id}
            />

            {!hasPrivateKeyInSecureStorage ? (
              <Section>
                <Text>
                  Go to settings and setup your private key to be able to post
                  onto the map.
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
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  contentStack: {
    flexDirection: "column",
    gap: 8,
  },
});
