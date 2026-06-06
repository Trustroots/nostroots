import { useAppSelector } from "@/redux/hooks";
import { mapSelectors } from "@/redux/slices/map.slice";
import { EventWithMetadata } from "@/redux/slices/events.slice";
import {
  countUpcomingGatherings,
  isGatheringEvent,
} from "@/utils/event-gathering.utils";
import { filterEventsForPlusCode } from "@/utils/map.utils";
import { hasSignalTag, isEventExpired } from "@/utils/signal.utils";
import { createSelector } from "@reduxjs/toolkit";
import { useMemo } from "react";
import { View } from "react-native";
import EventChatCard from "./EventChatCard";
import NotesSingle from "./NotesSingle";
import { Text } from "./ui/text";

interface MergedNoteData {
  eventWithMetadata: EventWithMetadata;
  isPlusCodeExact: boolean;
}

const notesListSelectorFactory = (plusCode: string) =>
  createSelector(mapSelectors.selectEventsForSelectedMapLayer, (events) => {
    const { eventsForPlusCodeExactly, eventsWithinPlusCode } =
      filterEventsForPlusCode(events, plusCode);

    const unexpiredExact = eventsForPlusCodeExactly.filter(
      (e) => !isEventExpired(e.event),
    );
    const unexpiredWithin = eventsWithinPlusCode.filter(
      (e) => !isEventExpired(e.event),
    );

    const exactIds = new Set(unexpiredExact.map((e) => e.event.id));

    const allEvents: MergedNoteData[] = [...unexpiredExact, ...unexpiredWithin]
      .sort((a, b) => a.event.created_at - b.event.created_at)
      .map((eventWithMetadata) => ({
        eventWithMetadata,
        isPlusCodeExact: exactIds.has(eventWithMetadata.event.id),
      }));

    return allEvents;
  });

export function useNotesListData(plusCode: string) {
  const selector = useMemo(
    () => notesListSelectorFactory(plusCode),
    [plusCode],
  );
  const allNotes = useAppSelector(selector);

  const { signalCount, noteCount, gatheringCount } = useMemo(() => {
    let signals = 0;
    let notes = 0;
    const gatheringEvents = allNotes
      .filter(({ eventWithMetadata }) =>
        isGatheringEvent(eventWithMetadata.event),
      )
      .map(({ eventWithMetadata }) => eventWithMetadata.event);
    const upcoming = countUpcomingGatherings(gatheringEvents);

    for (const { eventWithMetadata } of allNotes) {
      if (isGatheringEvent(eventWithMetadata.event)) {
        // counted separately
      } else if (hasSignalTag(eventWithMetadata.event)) {
        signals++;
      } else {
        notes++;
      }
    }
    return { signalCount: signals, noteCount: notes, gatheringCount: upcoming };
  }, [allNotes]);

  return { allNotes, signalCount, noteCount, gatheringCount };
}

export function getNotesSummaryText(
  signalCount: number,
  noteCount: number,
  gatheringCount?: number,
): string | null {
  const parts: string[] = [];
  if (gatheringCount && gatheringCount > 0)
    parts.push(
      `${gatheringCount} upcoming event${gatheringCount !== 1 ? "s" : ""}`,
    );
  if (signalCount > 0)
    parts.push(`${signalCount} signal${signalCount !== 1 ? "s" : ""}`);
  if (noteCount > 0)
    parts.push(`${noteCount} note${noteCount !== 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

export default function NotesList({
  plusCode,
  selectedEventId,
}: {
  plusCode: string;
  selectedEventId?: string | null;
}) {
  const { allNotes } = useNotesListData(plusCode);

  return (
    <>
      {/* Empty state */}
      {allNotes.length === 0 && (
        <View className="items-center justify-center py-20 px-8">
          <Text className="text-base text-muted-foreground/60 text-center">
            No messages yet. Be the first!
          </Text>
        </View>
      )}

      {/* Messages — oldest first (chat order) */}
      {allNotes.map(({ eventWithMetadata, isPlusCodeExact }) =>
        isGatheringEvent(eventWithMetadata.event) ? (
          <EventChatCard
            key={eventWithMetadata.event.id}
            eventWithMetadata={eventWithMetadata}
            isSelected={eventWithMetadata.event.id === selectedEventId}
          />
        ) : (
          <NotesSingle
            key={eventWithMetadata.event.id}
            eventWithMetadata={eventWithMetadata}
            isSelected={eventWithMetadata.event.id === selectedEventId}
            isPlusCodeExact={isPlusCodeExact}
          />
        ),
      )}
    </>
  );
}
