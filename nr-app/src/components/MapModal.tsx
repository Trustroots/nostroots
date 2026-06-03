import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useColorScheme } from "nativewind";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { useSelector } from "react-redux";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { EventWithMetadata } from "@/redux/slices/events.slice";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { RootState } from "@/redux/store";
import AddNoteForm from "./AddNoteForm";
import NotesList from "./NotesList";
import NotificationSubscription from "./NotificationSubscription";
import { Section } from "./ui/section";
import { Text } from "./ui/text";

export default function MapModal() {
  const dispatch = useAppDispatch();
  const { colorScheme } = useColorScheme();
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

  const sheetRef = useRef<BottomSheet>(null);
  const isDark = colorScheme === "dark";

  useEffect(() => {
    if (showModal) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [showModal]);

  const handleClose = () => {
    if (showModal) {
      dispatch(mapActions.closeMapModal());
    }
  };

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={["50%", "90%"]}
      index={-1}
      onChange={(index) => {
        if (index === -1) handleClose();
      }}
      onClose={handleClose}
      enablePanDownToClose
      containerStyle={{ zIndex: 100 }}
      backgroundStyle={{ backgroundColor: isDark ? "#0a0a0a" : "#ffffff" }}
      handleIndicatorStyle={{
        backgroundColor: isDark ? "#525252" : "#d1d5db",
      }}
    >
      <BottomSheetScrollView contentContainerClassName="p-4 pb-10">
        <View className="gap-2">
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
                <Text>
                  Choose the trustroots layer to be able to add content
                </Text>
              )}

              {selectedLayer === "trustroots" ? (
                <Section>
                  <NotificationSubscription />
                </Section>
              ) : null}
            </>
          )}
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
