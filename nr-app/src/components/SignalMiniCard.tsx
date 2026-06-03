// nr-app/src/components/SignalMiniCard.tsx
import { useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import { selectProfileByPubkey } from "@/redux/slices/profiles.slice";
import { SIGNAL_INTENTS } from "@/constants/signals";
import {
  getAuthorFromEvent,
  getFirstTagValueFromEvent,
  NOSTR_EXPIRATION_TAG_NAME,
} from "@trustroots/nr-common";
import { BadgeCheck, Clock, X } from "lucide-react-native";
import { useMemo } from "react";
import { Image, Pressable, View } from "react-native";
import { ExternalLink } from "./ExternalLink";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

function formatExpiry(expirationTimestamp: number): string | null {
  const now = Math.floor(Date.now() / 1000);
  const diff = expirationTimestamp - now;
  if (diff <= 0) return null;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function getIntentLabel(
  tags: string[][],
): { emoji: string; label: string } | undefined {
  for (const tag of tags) {
    if (tag[0] !== "t" || tag[1] === "signal") continue;
    const intent = SIGNAL_INTENTS.find((i) => i.key === tag[1]);
    if (intent) return { emoji: intent.emoji, label: intent.label };
  }
  return undefined;
}

export default function SignalMiniCard({
  signal,
  onClose,
}: {
  signal: EventWithMetadata;
  onClose: () => void;
}) {
  const pubkey = getAuthorFromEvent(signal.event);
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
  const intent = getIntentLabel(signal.event.tags);

  const expirationString = getFirstTagValueFromEvent(
    signal.event,
    NOSTR_EXPIRATION_TAG_NAME,
  );
  const expiration = expirationString ? parseInt(expirationString) : undefined;
  const expiryText = expiration ? formatExpiry(expiration) : null;

  return (
    <View className="mx-3 my-2 rounded-xl bg-card border border-border/30 p-4">
      <View className="flex-row items-start gap-3">
        {/* Avatar */}
        {profile?.picture ? (
          <Image
            source={{ uri: profile.picture }}
            className="h-10 w-10 rounded-full"
          />
        ) : (
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/20">
            <Text className="text-sm font-bold text-primary">
              {avatarLetter}
            </Text>
          </View>
        )}

        {/* Content */}
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5 flex-wrap">
            {typeof username !== "undefined" ? (
              <View className="flex-row items-center gap-0.5">
                <Text className="text-sm font-semibold text-primary">
                  {displayName}
                </Text>
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

            {intent && (
              <View className="flex-row items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5">
                <Text className="text-xs">{intent.emoji}</Text>
                <Text className="text-xs text-primary font-medium">
                  {intent.label}
                </Text>
              </View>
            )}
          </View>

          {/* Signal text */}
          <Text className="text-[15px] leading-snug text-foreground mt-1.5">
            {signal.event.content}
          </Text>

          {/* Expiry */}
          {expiryText && (
            <View className="flex-row items-center gap-1 mt-1.5">
              <Icon as={Clock} size={11} className="text-muted-foreground" />
              <Text className="text-xs text-muted-foreground">
                Expires in {expiryText}
              </Text>
            </View>
          )}

          {/* Trustroots link */}
          {typeof username !== "undefined" && (
            <ExternalLink href={`https://trustroots.org/messages/${username}`}>
              <View className="mt-3 rounded-lg bg-primary/10 py-2 px-3">
                <Text className="text-sm font-medium text-primary text-center">
                  Message on Trustroots →
                </Text>
              </View>
            </ExternalLink>
          )}
        </View>

        {/* Close button */}
        <Pressable
          onPress={onClose}
          className="w-7 h-7 rounded-full bg-muted/30 items-center justify-center"
        >
          <Icon as={X} size={14} className="text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  );
}
