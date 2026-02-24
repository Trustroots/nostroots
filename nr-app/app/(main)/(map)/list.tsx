import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { ArrowDownUp } from "lucide-react-native";
import { MAP_NOTE_REPOST_KIND } from "@trustroots/nr-common";

import { EmptyState } from "@/components/EmptyState";
import NotesSingle from "@/components/NotesSingle";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";

type KindFilter = "all" | "map-notes";
type SortOrder = "newest" | "oldest";

const FILTER_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "map-notes", label: "Map Notes" },
  { value: "all", label: "All Events" },
];

export default function ListScreen() {
  const [kindFilter, setKindFilter] = useState<KindFilter>("map-notes");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const allEvents = useAppSelector(eventsSelectors.selectAll);

  const filteredEvents = useMemo(() => {
    const events =
      kindFilter === "all"
        ? allEvents
        : allEvents.filter((e) => e.event.kind === MAP_NOTE_REPOST_KIND);

    return [...events].sort((a, b) =>
      sortOrder === "newest"
        ? b.event.created_at - a.event.created_at
        : a.event.created_at - b.event.created_at,
    );
  }, [allEvents, kindFilter, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"));
  };

  const renderItem = ({ item }: { item: EventWithMetadata }) => (
    <NotesSingle eventWithMetadata={item} isSelected={false} />
  );

  const ListHeader = () => (
    <View>
      <Text variant="h1">Notes</Text>
      <Text variant="muted" className="mb-4">
        {filteredEvents.length} notes
      </Text>

      <View className="flex-row items-center gap-2 mb-4">
        <Select
          value={{
            value: kindFilter,
            label:
              FILTER_OPTIONS.find((o) => o.value === kindFilter)?.label ?? "",
          }}
          onValueChange={(option) => {
            if (option) {
              setKindFilter(option.value as KindFilter);
            }
          }}
        >
          <SelectTrigger size="sm" className="flex-1">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                label={option.label}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onPress={toggleSortOrder}
          className="flex-row items-center gap-1"
        >
          <Icon as={ArrowDownUp} size={16} className="text-foreground" />
          <Text className="text-sm text-foreground">
            {sortOrder === "newest" ? "Newest" : "Oldest"}
          </Text>
        </Button>
      </View>
    </View>
  );

  return (
    <FlatList
      data={filteredEvents}
      keyExtractor={(item) => item.event.id}
      renderItem={renderItem}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={
        <EmptyState
          title="No notes yet"
          description="Notes will appear here once they are created"
        />
      }
      contentContainerClassName="p-safe-offset-4 bg-background"
      contentContainerStyle={{ flexGrow: 1 }}
      ItemSeparatorComponent={() => <View className="h-4" />}
    />
  );
}
