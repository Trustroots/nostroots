import { subscribeToPlusCode } from "@/redux/actions/notifications.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { RootState } from "@/redux/store";
import { useSelector } from "react-redux";

import { EventWithMetadata } from "@/redux/slices/events.slice";
import {
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddNoteForm from "./AddNoteForm";
import NotesList from "./NotesList";
import { Button } from "./ui/button";
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

  console.log("#Lz8K48 selectedEvent - mapModal", selectedEvent);

  const selectedLayer = useAppSelector(mapSelectors.selectSelectedLayer);

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const fullHeight = Math.max(height - top - bottom, 0);
  const snapPoints = useMemo(() => ["50%", "95%"], []);
  const bottomSheetContentStyle = useMemo(
    () => ({
      minHeight: fullHeight || height,
      paddingTop: top + 16,
      paddingBottom: bottom + 16,
      paddingHorizontal: 16,
    }),
    [fullHeight, height, top, bottom],
  );
  const scrollContentStyle = useMemo(() => ({ flexGrow: 1 }), []);

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
    <GestureHandlerRootView pointerEvents="box-none" style={styles.root}>
      <View pointerEvents="box-none" style={styles.provider}>
        <BottomSheetModalProvider>
          <BottomSheetModal
            ref={bottomSheetModalRef}
            snapPoints={snapPoints}
            enablePanDownToClose
            onDismiss={handleDismiss}
            backdropComponent={() => null}
            containerStyle={styles.modalContainer}
            backgroundStyle={styles.modalBackground}
          >
            <BottomSheetView style={[styles.sheet, bottomSheetContentStyle]}>
              <BottomSheetScrollView contentContainerStyle={scrollContentStyle}>
                <View style={styles.contentStack}>
                  <Button
                    variant="outline"
                    title="Close"
                    onPress={() => {
                      dispatch(mapActions.closeMapModal());
                    }}
                  />

                  <NotesList
                    plusCode={selectedPlusCode}
                    selectedEventId={selectedEvent?.event.id}
                  />

                  {selectedLayer === "trustroots" ? (
                    <AddNoteForm />
                  ) : (
                    <View>
                      <Text>
                        Choose the trustroots layer to be able to add content
                      </Text>
                    </View>
                  )}

                  <Section>
                    <Text variant="h2">Subscribe</Text>
                    <Text>Subscribe to notifications for this plus code</Text>
                    <Button
                      title="Subscribe"
                      onPress={() => {
                        dispatch(subscribeToPlusCode(selectedPlusCode));
                      }}
                    />
                  </Section>

                  <Button
                    variant="outline"
                    title="Close"
                    onPress={() => {
                      dispatch(mapActions.closeMapModal());
                    }}
                  />
                  <Text variant="muted">Modal is under development</Text>
                </View>
              </BottomSheetScrollView>
            </BottomSheetView>
          </BottomSheetModal>
        </BottomSheetModalProvider>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  provider: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
  modalBackground: {
    backgroundColor: "transparent",
  },
  sheet: {
    flex: 1,
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  contentStack: {
    flex: 1,
    flexDirection: "column",
    gap: 8,
  },
});
