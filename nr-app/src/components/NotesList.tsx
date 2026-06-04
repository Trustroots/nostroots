import { useAppSelector } from "@/redux/hooks";
import { mapSelectors } from "@/redux/slices/map.slice";
import { metricsSelectors } from "@/redux/slices/metrics.slice";
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

export default function NotesList({
  plusCode,
  selectedEventId,
}: {
  plusCode: string;
  selectedEventId?: string | null;
}) {
  const selector = useMemo(
    () => notesListSelectorFactory(plusCode),
    [plusCode],
  );
  const { eventsForPlusCodeExactly, eventsWithinPlusCode } =
    useAppSelector(selector);
  const allMetrics = useAppSelector(metricsSelectors.selectMetrics);
  const metricsForPlusCode = useMemo(
    () => allMetrics?.[plusCode] ?? null,
    [allMetrics, plusCode],
  );
  const pushSubscriptions = metricsForPlusCode?.["push-subscriptions"] ?? 0;

  // console.log("#Lz8K48 selectedEventId", selectedEventId);

  return (
    <>
      <Text className="text-gray-800 bg-amber-50 p-3 rounded-lg border-l-4 border-amber-500">
        {pushSubscriptions.toString()} subscriptions for{" "}
        <Text className="font-mono font-bold text-amber-600">{plusCode}</Text>
      </Text>
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
              isSelected={eventWithMetadata.event.id === selectedEventId}
              isPlusCodeExact={true}
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
              isSelected={eventWithMetadata.event.id === selectedEventId}
              isPlusCodeExact={false}
            />
          ))}
        </View>
      )}
    </>
  );
}
