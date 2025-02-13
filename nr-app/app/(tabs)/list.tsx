// import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useAppSelector } from "@/redux/hooks";
import { eventsSelectors } from "@/redux/slices/events.slice";
import { Picker } from "@react-native-picker/picker";

export default function TabTwoScreen() {
  const events = useAppSelector(eventsSelectors.selectAll);

  return (
    <SafeAreaView>
      <ScrollView>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">Stream of notes</ThemedText>
        </ThemedView>
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
        <Picker
          selectedValue={(365 * 60 * 24).toString()}
          onValueChange={(v) => {
            console.log("#taa250 Picker", v);
          }}
        >
          <Picker.Item
            label="1 year"
            value={(365 * 60 * 24).toString()}
            style={{ color: "red", backgroundColor: "blue" }}
          />
          <Picker.Item label="1 week" value={(7 * 60 * 24).toString()} />
          <Picker.Item label="1 month" value={(30 * 7 * 60 * 24).toString()} />
          <Picker.Item label="1 hour" value={(60 * 24).toString()} />
          <Picker.Item label="1 minute" value="60" />
        </Picker>
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
    color: "#008800",
  },
});
