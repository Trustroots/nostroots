import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import {
  getFirstTagValueFromEvent,
  MAP_NOTE_REPOST_KIND,
  NOSTR_EXPIRATION_TAG_NAME,
} from "@trustroots/nr-common";

import { EmptyState } from "@/components/EmptyState";
import SignalMiniCard from "@/components/SignalMiniCard";
import { FilterChips, FilterChip } from "./FilterChips";
import { SIGNAL_INTENTS } from "@/constants/signals";
import { getPlusCodeFromEvent } from "@/utils/event.utils";
import { navigateToEvent } from "@/utils/navigation.utils";
import { useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";

const SIGNAL_CHIPS: FilterChip[] = [
  { key: "all", label: "All" },
  ...SIGNAL_INTENTS.map((intent) => ({
    key: intent.key,
    label: intent.label,
    emoji: intent.emoji,
  })),
];

function isSignalEvent(event: EventWithMetadata): boolean {
  return event.event.tags.some((tag) => tag[0] === "t" && tag[1] === "signal");
}

function isUnexpired(event: EventWithMetadata): boolean {
  const expirationString = getFirstTagValueFromEvent(
    event.event,
    NOSTR_EXPIRATION_TAG_NAME,
  );
  if (!expirationString) return true;
  const expiration = parseInt(expirationString);
  const now = Math.floor(Date.now() / 1000);
  return expiration > now;
}

function hasIntentType(event: EventWithMetadata, intentKey: string): boolean {
  return event.event.tags.some((tag) => tag[0] === "t" && tag[1] === intentKey);
}

export function SignalsTab() {
  const [filter, setFilter] = useState("all");
  const allEvents = useAppSelector(eventsSelectors.selectAll);

  const signals = useMemo(() => {
    const activeSignals = allEvents
      .filter(
        (e) =>
          e.event.kind === MAP_NOTE_REPOST_KIND &&
          isSignalEvent(e) &&
          isUnexpired(e),
      )
      .sort((a, b) => b.event.created_at - a.event.created_at);

    if (filter === "all") return activeSignals;
    return activeSignals.filter((e) => hasIntentType(e, filter));
  }, [allEvents, filter]);

  return (
    <View className="flex-1">
      <FilterChips
        chips={SIGNAL_CHIPS}
        selectedKey={filter}
        onSelect={setFilter}
      />
      <FlatList
        data={signals}
        keyExtractor={(item) => item.event.id}
        renderItem={({ item }) => {
          const plusCode = getPlusCodeFromEvent(item.event);
          return (
            <Pressable
              onPress={() => {
                if (plusCode) navigateToEvent(plusCode, item.event);
              }}
            >
              <SignalMiniCard signal={item} onClose={() => {}} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="No active signals"
            description="Signals from nearby travelers will appear here"
          />
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
        ItemSeparatorComponent={() => <View className="h-1" />}
      />
    </View>
  );
}
