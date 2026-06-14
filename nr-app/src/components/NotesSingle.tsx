import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import {
  profilesActions,
  selectProfileByPubkey,
} from "@/redux/slices/profiles.slice";
import { settingsSelectors } from "@/redux/slices/settings.slice";
import { getPlusCodeFromEvent } from "@/utils/event.utils";
import { getRelativeTime } from "@/utils/time.utils";
import {
  getAuthorFromEvent,
  getFirstTagValueFromEvent,
  NOSTR_EXPIRATION_TAG_NAME,
} from "@trustroots/nr-common";
import { BadgeCheck, Clock } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { ExternalLink } from "./ExternalLink";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

function formatExpiry(expirationTimestamp: number): string | null {
  const now = Math.floor(Date.now() / 1000);
  const diff = expirationTimestamp - now;

  if (diff <= 0) return null;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 31536000) return `${Math.floor(diff / 86400)}d`;
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
  const dispatch = useAppDispatch();
  const isDeveloperMode = useAppSelector(
    settingsSelectors.selectAreTestFeaturesEnabled,
  );

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

  const createdAt = eventWithMetadata.event.created_at;
  const plusCode = getPlusCodeFromEvent(eventWithMetadata.event);
  const expirationString = getFirstTagValueFromEvent(
    eventWithMetadata.event,
    NOSTR_EXPIRATION_TAG_NAME,
  );
  const expiration = expirationString ? parseInt(expirationString) : undefined;
  const expiryText = expiration ? formatExpiry(expiration) : null;

  // eslint-disable-next-line react-hooks/purity -- Date.now() needed for relative time display
  const now = Math.floor(Date.now() / 1000);
  const showExpiry =
    expiryText !== null &&
    expiration !== undefined &&
    expiration - now < SEVEN_DAYS_SECONDS;

  const [isIdExpanded, setIsIdExpanded] = useState(false);
  const eventId = eventWithMetadata.event.id;
  const shortId = `${eventId.slice(0, 8)}...${eventId.slice(-8)}`;

  return (
    <View
      className={`mx-3 my-0.5 rounded-xl px-4 py-2 ${isSelected ? "bg-primary/10" : "bg-card"}`}
    >
      <View className="flex-row gap-3">
        {/* Avatar */}
        {profile?.picture ? (
          <Image
            source={{ uri: profile.picture }}
            className="h-9 w-9 rounded-full"
            accessibilityLabel={`${displayName ?? "Anonymous"} avatar`}
          />
        ) : (
          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/20">
            <Text className="text-sm font-bold text-primary">
              {avatarLetter}
            </Text>
          </View>
        )}

        {/* Content column */}
        <View className="flex-1">
          {/* Author line */}
          <View className="flex-row items-center gap-1.5 flex-wrap">
            {typeof username !== "undefined" ? (
              <View className="flex-row items-center gap-0.5">
                <ExternalLink
                  href={`https://trustroots.org/profile/${username}`}
                >
                  <Text className="text-sm font-semibold text-primary">
                    {displayName}
                  </Text>
                </ExternalLink>
                <Icon as={BadgeCheck} size={13} className="text-primary" />
              </View>
            ) : displayName ? (
              <Text className="text-sm font-semibold text-foreground">
                {displayName}
              </Text>
            ) : (
              <Text className="text-sm font-semibold text-muted-foreground">
                Anonymous
              </Text>
            )}

            {/* Timestamp */}
            <Text className="text-[11px] text-muted-foreground">
              {getRelativeTime(createdAt)}
            </Text>

            {/* Expiry if < 7 days */}
            {showExpiry && (
              <View className="flex-row items-center gap-0.5">
                <Icon as={Clock} size={9} className="text-muted-foreground" />
                <Text className="text-[11px] text-muted-foreground">
                  {expiryText}
                </Text>
              </View>
            )}

            {/* Pluscode suffix for non-exact */}
            {!isPlusCodeExact && plusCode && (
              <Text className="text-[10px] text-muted-foreground font-mono opacity-40">
                {plusCode}
              </Text>
            )}
          </View>

          {/* Message content */}
          <Text className="text-[15px] leading-snug text-foreground mt-1">
            {eventWithMetadata.event.content}
          </Text>

          {/* Dev mode event ID */}
          {isDeveloperMode && (
            <Pressable
              onPress={() => setIsIdExpanded(!isIdExpanded)}
              className="mt-0.5"
            >
              <Text className="text-[10px] text-muted-foreground font-mono">
                {isIdExpanded ? eventId : shortId}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
