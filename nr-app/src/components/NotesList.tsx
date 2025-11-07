import { useAppSelector } from "@/redux/hooks";
import { mapSelectors } from "@/redux/slices/map.slice";
import { filterEventsForPlusCode } from "@/utils/map.utils";
import { createSelector } from "@reduxjs/toolkit";
import { useMemo } from "react";
import { View } from "react-native";
import NotesSingle from "./NotesSingle";
import { Text } from "./ui/text";

const notesListSelectorFactory = (plusCode: string) =>
  createSelector(mapSelectors.selectEventsForSelectedMapLayer, (events) => {
    const { eventsForPlusCodeExactly, eventsWithinPlusCode } =
      filterEventsForPlusCode(events, plusCode);
    const sortedEvents = {
      eventsForPlusCodeExactly: eventsForPlusCodeExactly.sort(
        (a, b) => b.event.created_at - a.event.created_at,
      ),
      eventsWithinPlusCode: eventsWithinPlusCode.sort(
        (a, b) => b.event.created_at - a.event.created_at,
      ),
    };
    return sortedEvents;
  });

export default function NotesList({ plusCode }: { plusCode: string }) {
  const selector = useMemo(
    () => notesListSelectorFactory(plusCode),
    [plusCode],
  );
  const { eventsForPlusCodeExactly, eventsWithinPlusCode } =
    useAppSelector(selector);

  return (
    <>
      <Text className="text-gray-800 bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
        {eventsForPlusCodeExactly.length.toString()} exact matches for{" "}
        <Text className="font-mono font-bold text-blue-600">{plusCode}</Text>
      </Text>
      {eventsForPlusCodeExactly.length > 0 && (
        <View>
          {eventsForPlusCodeExactly.map((eventWithMetadata) => (
            <NotesSingle
              key={eventWithMetadata.event.id}
              eventWithMetadata={eventWithMetadata}
            />
          ))}
        </View>
      )}

      <Text className="text-gray-800 bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
        {eventsWithinPlusCode.length.toString()} within plus code{" "}
        <Text className="font-mono font-bold text-green-600">{plusCode}</Text>
      </Text>
      {eventsWithinPlusCode.length > 0 && (
        <View>
          {eventsWithinPlusCode.map((eventWithMetadata) => (
            <NotesSingle
              key={eventWithMetadata.event.id}
              eventWithMetadata={eventWithMetadata}
            />
          ))}
        </View>
      )}
    </>
  );
}
