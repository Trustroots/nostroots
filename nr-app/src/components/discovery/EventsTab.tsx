import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import {
  getFirstTagValueFromEvent,
  MAP_NOTE_REPOST_KIND,
} from "@trustroots/nr-common";

import { EmptyState } from "@/components/EmptyState";
import EventCard from "./EventCard";
import { FilterChips, FilterChip } from "./FilterChips";
import { useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";

type EventFilter = "upcoming" | "this-week" | "past";

const EVENT_CHIPS: FilterChip[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "this-week", label: "This week" },
  { key: "past", label: "Past" },
];

function getStartTimestamp(event: EventWithMetadata): number | undefined {
  const startTag = getFirstTagValueFromEvent(event.event, "start");
  return startTag ? parseInt(startTag) : undefined;
}

function isEventNote(event: EventWithMetadata): boolean {
  return event.event.tags.some((tag) => tag[0] === "start");
}

export function EventsTab() {
  const [filter, setFilter] = useState<EventFilter>("upcoming");
  const allEvents = useAppSelector(eventsSelectors.selectAll);

  // eslint-disable-next-line react-hooks/purity -- Date.now() needed for time-based filtering
  const now = Math.floor(Date.now() / 1000);

  const events = useMemo(() => {
    const oneWeekFromNow = now + 604800;

    const eventNotes = allEvents
      .filter((e) => e.event.kind === MAP_NOTE_REPOST_KIND && isEventNote(e))
      .map((e) => ({
        ...e,
        _startTimestamp: getStartTimestamp(e) ?? e.event.created_at,
      }));

    let filtered: typeof eventNotes;
    switch (filter) {
      case "upcoming":
        filtered = eventNotes.filter((e) => e._startTimestamp >= now);
        break;
      case "this-week":
        filtered = eventNotes.filter(
          (e) =>
            e._startTimestamp >= now && e._startTimestamp <= oneWeekFromNow,
        );
        break;
      case "past":
        filtered = eventNotes.filter((e) => e._startTimestamp < now);
        break;
    }

    // Sort by start date: upcoming/this-week ascending, past descending
    return filtered.sort((a, b) =>
      filter === "past"
        ? b._startTimestamp - a._startTimestamp
        : a._startTimestamp - b._startTimestamp,
    );
  }, [allEvents, filter, now]);

  return (
    <View className="flex-1">
      <FilterChips
        chips={EVENT_CHIPS}
        selectedKey={filter}
        onSelect={(key) => setFilter(key as EventFilter)}
      />
      <FlatList
        data={events}
        keyExtractor={(item) => item.event.id}
        renderItem={({ item }) => <EventCard eventWithMetadata={item} />}
        ListEmptyComponent={
          <EmptyState
            title="No events yet"
            description="Community events will appear here once they are created"
          />
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
        ItemSeparatorComponent={() => <View className="h-2" />}
      />
    </View>
  );
}
