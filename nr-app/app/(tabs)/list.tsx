// import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { startSubscription } from "@/redux/actions/subscription.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { eventsSelectors } from "@/redux/slices/events.slice";

export default function TabTwoScreen() {
  const events = useAppSelector(eventsSelectors.selectAll);
  const dispatch = useAppDispatch();

  return (
    <SafeAreaView>
      <ScrollView>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">Stream of notes</ThemedText>
        </ThemedView>
        <View>
          <Button
            title="Load 10 notes"
            onPress={async () => {
              dispatch(
                startSubscription({
                  filter: { kinds: [397], limit: 10 },
                  relayUrls: ["wss://relay.damus.io"],
                }),
              );
            }}
          />
        </View>
        <View>
          <Text style={styles.note}>
            We have a total of {events.length} notes.
          </Text>
          {events.map((event) => (
            <View key={event.event.id}>
              <Text style={styles.note}>{event.event.content}</Text>
              <Text style={styles.note}>
                {new Date(event.event.created_at * 1000).toLocaleString()}
              </Text>
              <Text style={styles.note}>{event.event.pubkey}</Text>
              <Text style={styles.note}>
                {Array.isArray(event.event.tags[1]) && event.event.tags[1][1]
                  ? event.event.tags[1][1]
                  : null}
              </Text>
              <Text style={styles.note}>----------------------</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    gap: 8,
  },
  note: {
    color: "#008800"
  }
});
