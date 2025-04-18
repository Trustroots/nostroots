import { useAppSelector } from "@/redux/hooks";
import { mapSelectors } from "@/redux/slices/map.slice";
import { filterEventsForPlusCode } from "@/utils/map.utils";
import { createSelector } from "@reduxjs/toolkit";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

const notesListSelectorFactory = (plusCode: string) =>
  createSelector(mapSelectors.selectEventsForSelectedMapLayer, (events) => {
    return filterEventsForPlusCode(events, plusCode);
  });

export default function NotesList({ plusCode }: { plusCode: string }) {
  const selector = useMemo(
    () => notesListSelectorFactory(plusCode),
    [plusCode],
  );
  const { eventsForPlusCodeExactly, eventsWithinPlusCode } =
    useAppSelector(selector);

  return (
    <View>
      <Text style={styles.heading}>
        {eventsForPlusCodeExactly.length.toString()} exact matches for{" "}
        {plusCode}
      </Text>
      {eventsForPlusCodeExactly.map((eventWithMetadata) => (
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
