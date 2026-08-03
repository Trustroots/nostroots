import {
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
} from "@expo/ui/community/bottom-sheet";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { X } from "lucide-react-native";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { EventWithMetadata } from "@/redux/slices/events.slice";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { RootState } from "@/redux/store";
import { ROUTES } from "@/constants/routes";
import AddNoteForm from "./AddNoteForm";
import { Button } from "./ui/button";
import NotesList, { getNotesSummaryText, useNotesListData } from "./NotesList";
import PeopleStrip from "./PeopleStrip";
import SubscribeBellIcon from "./SubscribeBellIcon";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

export default function MapModal() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { height } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
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

  const [signalMode, setSignalMode] = useState(false);
  const isDark = colorScheme === "dark";

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const fullHeight = Math.max(height - top, 0);
  const snapPoints = useMemo(
    () => [fullHeight || height],
    [fullHeight, height],
  );

  const { signalCount, noteCount } = useNotesListData(selectedPlusCode);
  const summaryText = getNotesSummaryText(signalCount, noteCount);

  useEffect(() => {
    if (showModal) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [showModal]);

  const handleDismiss = useCallback(() => {
    setSignalMode(false);
    if (showModal) {
      dispatch(mapActions.closeMapModal());
    }
  }, [showModal, dispatch]);

  const handleClose = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const handleSetUpAccount = useCallback(() => {
    bottomSheetRef.current?.dismiss();
    router.push(ROUTES.ONBOARDING);
  }, [router]);

  const canPost =
    hasPrivateKeyInSecureStorage && selectedLayer === "trustroots";

  return (
    <BottomSheetModalProvider>
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        onDismiss={handleDismiss}
        backgroundStyle={{ backgroundColor: isDark ? "#0a0a0a" : "#ffffff" }}
        handleIndicatorStyle={{
          backgroundColor: isDark ? "#525252" : "#d1d5db",
        }}
      >
        {/* Header: plus code + bell + close */}
        <View className="px-5 pb-2 pt-1 flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-2">
            <Text className="text-lg font-bold text-foreground">
              {selectedPlusCode}
            </Text>
            {selectedLayer === "trustroots" && hasPrivateKeyInSecureStorage && (
              <SubscribeBellIcon />
            )}
          </View>
          <Pressable
            onPress={handleClose}
            className="w-8 h-8 rounded-full bg-muted/50 items-center justify-center"
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Icon as={X} size={16} className="text-foreground" />
          </Pressable>
        </View>

        {/* People strip */}
        <PeopleStrip
          plusCode={selectedPlusCode}
          signalMode={signalMode}
          onToggleSignalMode={() => setSignalMode(!signalMode)}
          canPost={canPost}
        />

        {/* Summary — fixed above scroll area */}
        {summaryText && (
          <View className="px-5 py-1.5 border-b border-border/10">
            <Text className="text-[11px] text-muted-foreground">
              {summaryText}
            </Text>
          </View>
        )}

        {/* Chat */}
        <BottomSheetScrollView
          contentContainerStyle={{ paddingVertical: 4, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <NotesList
            plusCode={selectedPlusCode}
            selectedEventId={selectedEvent?.event.id}
          />
        </BottomSheetScrollView>

        {/* Compose bar — pinned to bottom */}
        <View className="border-t border-border/15 bg-muted/10">
          {!hasPrivateKeyInSecureStorage ? (
            <View className="px-5 py-3 gap-2">
              <Text className="text-sm text-muted-foreground">
                Set up your Trustroots account to post here.
              </Text>
              <Button
                variant="secondary"
                onPress={handleSetUpAccount}
                title="Set up account"
              />
            </View>
          ) : selectedLayer === "trustroots" ? (
            <AddNoteForm
              signalMode={signalMode}
              onSignalSent={() => setSignalMode(false)}
            />
          ) : (
            <View className="px-5 py-3">
              <Text className="text-sm text-muted-foreground">
                Choose the trustroots layer to add content.
              </Text>
            </View>
          )}
        </View>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  );
}
