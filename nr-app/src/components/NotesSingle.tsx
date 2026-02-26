import { useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import { settingsSelectors } from "@/redux/slices/settings.slice";
import { getPlusCodeFromEvent } from "@/utils/event.utils";
import { getRelativeTime } from "@/utils/time.utils";
import {
  getAuthorFromEvent,
  getFirstTagValueFromEvent,
  NOSTR_EXPIRATION_TAG_NAME,
} from "@trustroots/nr-common";
import { BadgeCheck, Clock } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { ExternalLink } from "./ExternalLink";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

function NoteAuthorInfo({
  authorPublicKey,
  createdAt,
}: {
  authorPublicKey?: string;
  createdAt: number;
}) {
  const selectTrustrootsUsername = useMemo(
    () => eventsSelectors.selectTrustrootsUsernameFactory(authorPublicKey),
    [authorPublicKey],
  );
  const username = useAppSelector(selectTrustrootsUsername);

  // Username exists means NIP-05 verified via trustroots.org (primary badge)
  return (
    <View className="flex-row items-center flex-wrap gap-1">
      <View className="flex-row items-center gap-0.5">
        {typeof username === "undefined" ? (
          <Text className="font-semibold text-foreground text-sm">
            Anonymous
          </Text>
        ) : (
          <>
            <ExternalLink href={`https://trustroots.org/profile/${username}`}>
              <Text className="font-semibold text-primary text-sm">
                {username}
              </Text>
            </ExternalLink>
            <Icon as={BadgeCheck} size={16} className="text-primary ml-0.5" />
          </>
        )}
      </View>
      <Text className="text-muted-foreground text-lg mx-1">·</Text>
      <Text className="text-muted-foreground text-xs font-semibold">
        {getRelativeTime(createdAt)}
      </Text>
    </View>
  );
}

function formatExpiry(expirationTimestamp: number): string | null {
  const now = Math.floor(Date.now() / 1000);
  const diff = expirationTimestamp - now;

  if (diff <= 0) {
    return null; // Expired
  }

  if (diff < 3600) {
    return `${Math.floor(diff / 60)}m`;
  }

  if (diff < 86400) {
    return `${Math.floor(diff / 3600)}h`;
  }

  if (diff < 31536000) {
    return `${Math.floor(diff / 86400)}d`;
  }

  return `${Math.floor(diff / 31536000)}yr`;
}

export default function NotesSingle({
  eventWithMetadata,
  isSelected,
  isPlusCodeExact = true,
}: {
  eventWithMetadata: EventWithMetadata;
  isSelected: boolean;
  isPlusCodeExact?: boolean;
}) {
  const authorPublicKey = getAuthorFromEvent(eventWithMetadata.event);
  const isDeveloperMode = useAppSelector(
    settingsSelectors.selectAreTestFeaturesEnabled,
  );

  const createdAt = eventWithMetadata.event.created_at;
  const plusCode = getPlusCodeFromEvent(eventWithMetadata.event);
  const expirationString = getFirstTagValueFromEvent(
    eventWithMetadata.event,
    NOSTR_EXPIRATION_TAG_NAME,
  );
  const expiration = expirationString ? parseInt(expirationString) : undefined;
  const expiryText = expiration ? formatExpiry(expiration) : null;

  const [isIdExpanded, setIsIdExpanded] = useState(false);
  const eventId = eventWithMetadata.event.id;
  const shortId = `${eventId.slice(0, 8)}...${eventId.slice(-8)}`;

  return (
    <View
      className={`px-4 py-3 border-b ${isSelected ? "bg-primary/5 border-primary/30" : "border-border/50"}`}
    >
      {/* Header: Name + badge + timestamp left, plus code right */}
      <View className="flex-row items-center justify-between">
        <NoteAuthorInfo
          authorPublicKey={authorPublicKey}
          createdAt={createdAt}
        />
        {plusCode && (
          <Text
            className={`text-xs bg-muted p-1 text-muted-foreground font-mono ${isPlusCodeExact ? "" : "opacity-40"}`}
          >
            {plusCode}
          </Text>
        )}
      </View>

      {/* Content */}
      <Text className="text-[15px] leading-snug mt-1 text-foreground">
        {eventWithMetadata.event.content}
      </Text>

      {/* Footer: ID left (dev mode), expiry right */}
      {(isDeveloperMode || expiryText) && (
        <View className="flex-row items-center justify-between mt-3">
          {/* ID - only shown in developer mode */}
          {isDeveloperMode ? (
            <Pressable onPress={() => setIsIdExpanded(!isIdExpanded)}>
              <Text className="text-xs text-muted-foreground font-mono">
                ID: {isIdExpanded ? eventId : shortId}
              </Text>
            </Pressable>
          ) : (
            <View />
          )}

          {/* Expiry */}
          {expiryText && (
            <View className="flex-row items-center gap-1">
              <Icon as={Clock} size={12} className="text-muted-foreground" />
              <Text className="text-xs text-muted-foreground">
                {expiryText}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
