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
import { useDispatch, useSelector } from "react-redux";

import { EventWithMetadata } from "../redux/slices/events.slice";
import { mapActions } from "../redux/slices/map.slice";
import { RootState } from "../redux/store";
import { getKindName } from "../utils/event.utils";
import { Section } from "./ui/section";
import { Text } from "./ui/text";

export default function HalfMapEventModal() {
  const dispatch = useDispatch();
  const showHalfMapEventModal = useSelector(
    (state: RootState) => state.map.isHalfMapEventModalOpen,
  );
  const selectedEvent = useSelector(
    (state: RootState) => state.map.currentNotificationEvent,
  ) as EventWithMetadata | undefined;

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const fullHeight = Math.max(height - top - bottom, 0);
  const snapPoints = useMemo(
    () => [fullHeight * 0.5 || height * 0.5, fullHeight || height],
    [fullHeight, height],
  );
  const bottomSheetContentStyle = useMemo(
    () => ({ minHeight: fullHeight || height }),
    [fullHeight, height],
  );

  useEffect(() => {
    if (showHalfMapEventModal) {
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [showHalfMapEventModal]);

  const handleDismiss = () => {
    if (showHalfMapEventModal) {
      dispatch(mapActions.closeHalfMapEventModal());
    }
  };

  return (
    <GestureHandlerRootView pointerEvents="box-none" style={styles.root}>
      <View style={styles.provider} pointerEvents="box-none">
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
            <BottomSheetView
              className="flex-1 rounded-t-3xl bg-background p-8 shadow-2xl"
              style={bottomSheetContentStyle}
            >
              {selectedEvent ? (
                <View className="flex-1">
                  <BottomSheetScrollView
                    contentContainerStyle={styles.scrollContent}
                  >
                    <View className="space-y-4">
                      {/* Divider */}
                      <Text className="text-xs text-gray-500">
                        {getKindName(selectedEvent.event.kind)} -
                        {new Date(
                          selectedEvent.event.created_at * 1000,
                        ).toLocaleDateString()}
                        -{" "}
                        {new Date(
                          selectedEvent.event.created_at * 1000,
                        ).toLocaleTimeString()}
                      </Text>

                      {/* Divider */}
                      <View className="my-4 h-px bg-gray-200" />

                      {/* Content */}
                      <Text className="text-base">
                        {selectedEvent.event.content}
                      </Text>
                    </View>
                  </BottomSheetScrollView>

                  {/* Footer */}
                  <View className="mt-4 space-y-2 border-t border-gray-200 pt-4">
                    <Text
                      selectable
                      numberOfLines={1}
                      className="flex-shrink text-sm text-gray-500"
                    >
                      <Text className="text-sm font-bold">Author: </Text>
                      {selectedEvent.event.pubkey}...
                    </Text>

                    <Text
                      selectable
                      numberOfLines={1}
                      className="text-sm text-gray-500"
                    >
                      <Text className="text-sm font-bold">ID: </Text>
                      {selectedEvent.event.id}
                    </Text>
                    <Text
                      selectable
                      numberOfLines={1}
                      className="text-sm text-gray-500"
                    >
                      <Text className="text-sm font-bold">Signature: </Text>
                      {selectedEvent.event.sig}
                    </Text>
                  </View>
                </View>
              ) : (
                <Section>
                  <Text>No event selected.</Text>
                </Section>
              )}
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
  scrollContent: {
    flexGrow: 1,
  },
});
