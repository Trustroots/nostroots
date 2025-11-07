import { subscribeToPlusCode } from "@/redux/actions/notifications.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Button } from "./ui/button";
import { Section } from "./ui/section";
import { Text } from "./ui/text";

export default function HalfMapEventModal() {
  const dispatch = useAppDispatch();
  const showHalfMapEventModal = useAppSelector(
    mapSelectors.selectIsHalfMapEventModalOpen,
  );
  const selectedPlusCode = useAppSelector(mapSelectors.selectSelectedPlusCode);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showHalfMapEventModal}
      onRequestClose={() => {
        dispatch(mapActions.closeHalfMapEventModal());
      }}
    >
      <Pressable
        onPress={() => dispatch(mapActions.closeHalfMapEventModal())}
        className="flex-1 bg-black/50"
      ></Pressable>
      <View className="h-1/2 rounded-t-3xl bg-background p-4 shadow-2xl">
        <View className="flex-row items-center justify-between">
          <Text variant="h2">{selectedPlusCode}</Text>
          <Button
            variant="ghost"
            size="icon"
            onPress={() => {
              dispatch(mapActions.closeHalfMapEventModal());
            }}
          >
            <Text>Close</Text>
          </Button>
        </View>

        <ScrollView>
          <Section>
            <Button
              variant="outline"
              title="Subscribe to this plus code"
              onPress={() => {
                dispatch(subscribeToPlusCode({ plusCode: selectedPlusCode }));
              }}
            />
          </Section>
        </ScrollView>
      </View>
    </Modal>
  );
}
