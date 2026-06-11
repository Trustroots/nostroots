import { useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import { selectProfileByPubkey } from "@/redux/slices/profiles.slice";
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

  // Get the start tag for the event date
  const startTag = getFirstTagValueFromEvent(eventWithMetadata.event, "start");
  const startTimestamp = startTag ? parseInt(startTag) : undefined;

  // Use event title from the "title" tag, or fall back to content
  const title = getFirstTagValueFromEvent(eventWithMetadata.event, "title");
  const content = eventWithMetadata.event.content;

  return (
    <View className="mx-3 my-0.5 rounded-xl bg-card border border-blue-200 dark:border-blue-800 overflow-hidden">
      {/* Blue accent bar */}
      <View className="h-1 bg-blue-500" />

      <View className="p-4">
        {/* Title */}
        <Text className="text-base font-bold text-foreground">
          {title || content}
        </Text>

        {/* Start date */}
        {startTimestamp && (
          <View className="flex-row items-center gap-1.5 mt-2">
            <Icon as={CalendarDays} size={14} className="text-blue-500" />
            <Text className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              {formatEventDate(startTimestamp)}
            </Text>
          </View>
        )}

        {/* Location */}
        {plusCode && (
          <View className="flex-row items-center gap-1.5 mt-1.5">
            <Icon as={MapPin} size={14} className="text-muted-foreground" />
            <Text className="text-xs text-muted-foreground">{plusCode}</Text>
          </View>
        )}

        {/* Description (only if there is both title and content) */}
        {title && content && (
          <Text
            className="text-sm text-muted-foreground mt-2"
            numberOfLines={2}
          >
            {content}
          </Text>
        )}

        {/* Author */}
        <View className="flex-row items-center gap-2 mt-3 pt-3 border-t border-border/50">
          {profile?.picture ? (
            <Image
              source={{ uri: profile.picture }}
              className="h-6 w-6 rounded-full"
            />
          ) : (
            <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-500/20">
              <Text className="text-[10px] font-bold text-blue-500">
                {avatarLetter}
              </Text>
            </View>
          )}
          {typeof username !== "undefined" ? (
            <View className="flex-row items-center gap-0.5">
              <Text className="text-xs font-medium text-primary">
                {displayName}
              </Text>
              <Icon as={BadgeCheck} size={11} className="text-primary" />
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
