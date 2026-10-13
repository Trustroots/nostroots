import { useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import { selectProfileByPubkey } from "@/redux/slices/profiles.slice";
import { getEventStart, isGatheringEvent } from "@/utils/event-gathering.utils";
import { getPlusCodeFromEvent } from "@/utils/event.utils";
import {
  getAuthorFromEvent,
  getFirstTagValueFromEvent,
} from "@trustroots/nr-common";
import { BadgeCheck, CalendarDays, MapPin } from "lucide-react-native";
import { useMemo } from "react";
import { Image, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

function formatEventDate(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) {
    return `Today at ${timeStr}`;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow at ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${dateStr} at ${timeStr}`;
}

export default function EventCard({
  eventWithMetadata,
}: {
  eventWithMetadata: EventWithMetadata;
}) {
  const pubkey = getAuthorFromEvent(eventWithMetadata.event);
  const profile = useAppSelector((state) =>
    selectProfileByPubkey(state, pubkey),
  );
  const selectUsername = useMemo(
    () => eventsSelectors.selectTrustrootsUsernameFactory(pubkey),
    [pubkey],
  );
  const username = useAppSelector(selectUsername);
  const displayName = profile?.name || username;
  const avatarLetter = (displayName || "?")[0].toUpperCase();

  const plusCode = getPlusCodeFromEvent(eventWithMetadata.event);

  const startTimestamp = getEventStart(eventWithMetadata.event);

  // Use event title from the "title" tag, or fall back to content
  const title = getFirstTagValueFromEvent(eventWithMetadata.event, "title");
  const content = eventWithMetadata.event.content;

  return (
    <View className="mx-3 rounded-xl border border-border bg-card p-4">
      {startTimestamp && (
        <View className="flex-row items-center gap-1.5">
          <Icon as={CalendarDays} size={14} className="text-primary" />
          <Text className="text-sm font-medium text-primary">
            {formatEventDate(startTimestamp)}
          </Text>
        </View>
      )}

      <Text
        className={`text-base font-semibold text-foreground ${startTimestamp ? "mt-1.5" : ""}`}
      >
        {title || content}
      </Text>

      {title && content && (
        <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={2}>
          {content}
        </Text>
      )}

      <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-1.5">
        {plusCode && (
          <View className="flex-row items-center gap-1">
            <Icon as={MapPin} size={13} className="text-muted-foreground" />
            <Text className="text-xs text-muted-foreground">{plusCode}</Text>
          </View>
        )}
        <View className="flex-row items-center gap-1.5">
          {profile?.picture ? (
            <Image
              source={{ uri: profile.picture }}
              className="h-5 w-5 rounded-full"
            />
          ) : (
            <View className="h-5 w-5 items-center justify-center rounded-full bg-primary/15">
              <Text className="text-[10px] font-bold text-primary">
                {avatarLetter}
              </Text>
            </View>
          )}
          {typeof username !== "undefined" &&
          !isGatheringEvent(eventWithMetadata.event) ? (
            <View className="flex-row items-center gap-0.5">
              <Text className="text-xs font-medium text-primary">
                {displayName}
              </Text>
              <View testID="verified-badge">
                <Icon as={BadgeCheck} size={11} className="text-primary" />
              </View>
            </View>
          ) : displayName ? (
            <Text className="text-xs font-medium text-foreground">
              {displayName}
            </Text>
          ) : (
            <Text className="text-xs text-muted-foreground">Anonymous</Text>
          )}
        </View>
      </View>
    </View>
  );
}
