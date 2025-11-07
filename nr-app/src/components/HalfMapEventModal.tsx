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
      <View className="h-1/2 rounded-t-3xl bg-background p-4 shadow-2xl">
        <View style={{ flex: 1 }}>
          <ScrollView>
            {selectedEvent ? (
              <Section>
                <Text>
                  <Text className="font-bold">Created At: </Text>
                  {new Date(
                    selectedEvent.event.created_at * 1000,
                  ).toLocaleString()}
                </Text>

                <Text selectable numberOfLines={1}>
                  <Text className="font-bold">id: </Text>
                  {selectedEvent.event.id}
                </Text>

                <Text selectable numberOfLines={1}>
                  <Text className="font-bold">author: </Text>
                  {selectedEvent.event.pubkey}
                </Text>

                <Text>
                  <Text className="font-bold">kind: </Text>
                  {getKindName(selectedEvent.event.kind)}
                </Text>

                <Text>
                  <Text className="font-bold">Content: </Text>
                  {selectedEvent.event.content}
                </Text>

                {/* <Text className="mt-2 font-bold text-sm">Tags:</Text>
                {selectedEvent.event.tags.map((tag, index) => (
                  <Text key={index} className="ml-2">
                    - [{tag.map((t) => `"${t}"`).join(", ")}]
                  </Text>
                ))} */}

                <Text selectable numberOfLines={1}>
                  <Text className="font-bold">signature: </Text>
                  {selectedEvent.event.sig}
                </Text>

                {/* <Text className="mt-2 font-bold">Seen on Relays:</Text>
                {selectedEvent.metadata.seenOnRelays.map((relay, index) => (
                  <Text key={index} className="ml-2">
                    - {relay}
                  </Text>
                ))} */}
              </Section>
            ) : (
              <Section>
                <Text>No event selected.</Text>
              </Section>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
