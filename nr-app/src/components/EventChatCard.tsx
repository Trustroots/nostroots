import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import {
  profilesActions,
  selectProfileByPubkey,
} from "@/redux/slices/profiles.slice";
import {
  formatGatheringDateTime,
  getGatheringEnd,
  getGatheringStart,
  getGatheringTitle,
} from "@/utils/event-gathering.utils";
import { getRelativeTime } from "@/utils/time.utils";
import { getAuthorFromEvent } from "@trustroots/nr-common";
import { Calendar, BadgeCheck } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { Image, View } from "react-native";
import { ExternalLink } from "./ExternalLink";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

export default function EventChatCard({
  eventWithMetadata,
  isSelected,
}: {
  eventWithMetadata: EventWithMetadata;
  isSelected: boolean;
}) {
  const dispatch = useAppDispatch();
  const authorPublicKey = getAuthorFromEvent(eventWithMetadata.event);

  const profile = useAppSelector((state) =>
    selectProfileByPubkey(state, authorPublicKey),
  );

  useEffect(() => {
    dispatch(profilesActions.fetchProfile(authorPublicKey));
  }, [dispatch, authorPublicKey]);

  const selectTrustrootsUsername = useMemo(
    () => eventsSelectors.selectTrustrootsUsernameFactory(authorPublicKey),
    [authorPublicKey],
  );
  const username = useAppSelector(selectTrustrootsUsername);

  const displayName = profile?.name || username;
  const avatarLetter = (displayName || "?")[0].toUpperCase();

  const title = getGatheringTitle(eventWithMetadata.event);
  const start = getGatheringStart(eventWithMetadata.event);
  const end = getGatheringEnd(eventWithMetadata.event);
  const description = eventWithMetadata.event.content;
  const createdAt = eventWithMetadata.event.created_at;

  const startText = start !== undefined ? formatGatheringDateTime(start) : null;
  const endText = end !== undefined ? formatGatheringDateTime(end) : null;

  return (
    <View
      className={`mx-3 my-1 rounded-xl border border-primary/30 px-4 py-3 ${
        isSelected ? "bg-primary/10" : "bg-primary/5"
      }`}
    >
      {/* Author line */}
      <View className="flex-row items-center gap-2 mb-2">
        {profile?.picture ? (
          <Image
            source={{ uri: profile.picture }}
            className="h-7 w-7 rounded-full"
            accessibilityLabel={`${displayName ?? "Anonymous"} avatar`}
          />
        ) : (
          <View className="h-7 w-7 items-center justify-center rounded-full bg-primary/20">
            <Text className="text-xs font-bold text-primary">
              {avatarLetter}
            </Text>
          </View>
        )}
        <View className="flex-row items-center gap-1 flex-1">
          {typeof username !== "undefined" ? (
            <View className="flex-row items-center gap-0.5">
              <ExternalLink href={`https://trustroots.org/profile/${username}`}>
                <Text className="text-xs font-semibold text-primary">
                  {displayName}
                </Text>
              </ExternalLink>
              <Icon as={BadgeCheck} size={11} className="text-primary" />
            </View>
          ) : displayName ? (
            <Text className="text-xs font-semibold text-foreground">
              {displayName}
            </Text>
          ) : (
            <Text className="text-xs font-semibold text-muted-foreground">
              Anonymous
            </Text>
          )}
          <Text className="text-[10px] text-muted-foreground">
            {getRelativeTime(createdAt)}
          </Text>
        </View>
      </View>

      {/* Event title */}
      {title && (
        <Text className="text-base font-bold text-foreground mb-1">
          {title}
        </Text>
      )}

      {/* Date/time row */}
      {startText && (
        <View className="flex-row items-center gap-1.5 mb-1">
          <Icon as={Calendar} size={13} className="text-primary" />
          <Text className="text-xs text-foreground">
            {startText}
            {endText ? ` - ${endText}` : ""}
          </Text>
        </View>
      )}

      {/* Description */}
      {description.length > 0 && (
        <Text className="text-sm leading-snug text-foreground/80 mt-1">
          {description}
        </Text>
      )}
    </View>
  );
}
