import { useAppSelector } from "@/redux/hooks";
import { eventsSelectors } from "@/redux/slices/events.slice";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function NotesList({ plusCode }: { plusCode: string }) {
  const selectEventsForPlusCodeExactly = useMemo(
    () => eventsSelectors.selectEventsForPlusCodeExactlyFactory(plusCode),
    [plusCode],
  );
  const events = useAppSelector(selectEventsForPlusCodeExactly);
  const selectEventsWithinPlusCode = useMemo(
    () => eventsSelectors.selectEventsWithinPlusCodeFactory(plusCode),
    [plusCode],
  );
  const eventsWithinPlusCode = useAppSelector(selectEventsWithinPlusCode);

  return (
    <View>
      <Text style={styles.heading}>
        {events.length.toString()} exact matches for {plusCode}
      </Text>
      {events.map((eventWithMetadata) => (
        <View key={eventWithMetadata.event.id}>
          <Text>Note ID: {eventWithMetadata.event.id}</Text>
          <Text>Content: {eventWithMetadata.event.content}</Text>
        </View>
      ))}
      <Text style={styles.heading}>
        {eventsWithinPlusCode.length.toString()} within plus code {plusCode}
      </Text>
      {eventsWithinPlusCode.map((eventWithMetadata) => (
        <View key={eventWithMetadata.event.id}>
          <Text>Note ID: {eventWithMetadata.event.id}</Text>
          <Text>Content: {eventWithMetadata.event.content}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 18,
  },
});
