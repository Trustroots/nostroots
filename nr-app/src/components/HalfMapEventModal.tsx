import { ScrollView, View } from "react-native";
import Modal from "react-native-modal";
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

  return (
    <Modal
      isVisible={showHalfMapEventModal}
      onSwipeComplete={() => dispatch(mapActions.closeHalfMapEventModal())}
      swipeDirection={["down"]}
      style={{ justifyContent: "flex-end", margin: 0 }}
      backdropOpacity={0}
    >
      <View className="h-1/2 rounded-t-3xl bg-background p-8 shadow-2xl">
        {selectedEvent ? (
          <View className="flex-1">
            <ScrollView>
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
                <Text className="text-base">{selectedEvent.event.content}</Text>
              </View>
            </ScrollView>

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
      </View>
    </Modal>
  );
}
