import { useAppSelector } from "@/redux/hooks";
import { mapSelectors } from "@/redux/slices/map.slice";
import { filterEventsForPlusCode } from "@/utils/map.utils";
import { createSelector } from "@reduxjs/toolkit";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import NotesSingle from "./NotesSingle";

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
        <NotesSingle
          key={eventWithMetadata.event.id}
          eventWithMetadata={eventWithMetadata}
        />
      ))}
      <Text style={styles.heading}>
        {eventsWithinPlusCode.length.toString()} within plus code {plusCode}
      </Text>
      {eventsWithinPlusCode.map((eventWithMetadata) => (
        <NotesSingle
          key={eventWithMetadata.event.id}
          eventWithMetadata={eventWithMetadata}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 18,
  },
});
