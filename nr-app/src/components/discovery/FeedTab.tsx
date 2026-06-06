import { useMemo } from "react";
import { SectionList, View } from "react-native";
import { MAP_NOTE_REPOST_KIND } from "@trustroots/nr-common";

import { EmptyState } from "@/components/EmptyState";
import NotesSingle from "@/components/NotesSingle";
import { Text } from "@/components/ui/text";
import { useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";

interface Section {
  title: string;
  data: EventWithMetadata[];
}

function groupByTime(events: EventWithMetadata[]): Section[] {
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 86400;
  const oneWeekAgo = now - 604800;

  const today: EventWithMetadata[] = [];
  const thisWeek: EventWithMetadata[] = [];
  const older: EventWithMetadata[] = [];

  for (const event of events) {
    const createdAt = event.event.created_at;
    if (createdAt >= oneDayAgo) {
      today.push(event);
    } else if (createdAt >= oneWeekAgo) {
      thisWeek.push(event);
    } else {
      older.push(event);
    }
  }

  const sections: Section[] = [];
  if (today.length > 0) sections.push({ title: "Today", data: today });
  if (thisWeek.length > 0)
    sections.push({ title: "This week", data: thisWeek });
  if (older.length > 0) sections.push({ title: "Older", data: older });

  return sections;
}

export function FeedTab() {
  const allEvents = useAppSelector(eventsSelectors.selectAll);

  const mapNotes = useMemo(
    () =>
      allEvents
        .filter((e) => e.event.kind === MAP_NOTE_REPOST_KIND)
        .sort((a, b) => b.event.created_at - a.event.created_at),
    [allEvents],
  );

  const sections = useMemo(() => groupByTime(mapNotes), [mapNotes]);

  return (
    <View className="flex-1">
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.event.id}
        renderItem={({ item }) => (
          <NotesSingle eventWithMetadata={item} isSelected={false} />
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View className="px-4 pt-4 pb-2 bg-background">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {title}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No notes yet"
            description="Notes will appear here once they are created"
          />
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => <View className="h-2" />}
      />
    </View>
  );
}
