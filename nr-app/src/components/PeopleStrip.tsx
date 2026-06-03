import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapSelectors } from "@/redux/slices/map.slice";
import {
  profilesActions,
  selectProfileByPubkey,
} from "@/redux/slices/profiles.slice";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import { getActiveSignals } from "@/utils/signal.utils";
import { filterEventsForPlusCode } from "@/utils/map.utils";
import { getAuthorFromEvent } from "@trustroots/nr-common";
import { SIGNAL_INTENTS } from "@/constants/signals";
import { Minus, Plus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";
import SignalMiniCard from "./SignalMiniCard";

function getIntentEmoji(tags: string[][]): string | undefined {
  for (const tag of tags) {
    if (tag[0] !== "t" || tag[1] === "signal") continue;
    const intent = SIGNAL_INTENTS.find((i) => i.key === tag[1]);
    if (intent) return intent.emoji;
  }
  return undefined;
}

function PersonBubble({
  signal,
  isExpanded,
  onPress,
}: {
  signal: EventWithMetadata;
  isExpanded: boolean;
  onPress: () => void;
}) {
  const pubkey = getAuthorFromEvent(signal.event);
  const dispatch = useAppDispatch();
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
  const intentEmoji = getIntentEmoji(signal.event.tags);

  useEffect(() => {
    dispatch(profilesActions.fetchProfile(pubkey));
  }, [dispatch, pubkey]);

  return (
    <Pressable onPress={onPress} className="items-center" style={{ width: 56 }}>
      <View style={{ position: "relative" }}>
        {profile?.picture ? (
          <Image
            source={{ uri: profile.picture }}
            className="h-11 w-11 rounded-full"
            style={
              isExpanded
                ? { borderWidth: 2, borderColor: "#0a84ff" }
                : undefined
            }
          />
        ) : (
          <View
            className="h-11 w-11 items-center justify-center rounded-full bg-primary/20"
            style={
              isExpanded
                ? { borderWidth: 2, borderColor: "#0a84ff" }
                : undefined
            }
          >
            <Text className="text-sm font-bold text-primary">
              {avatarLetter}
            </Text>
          </View>
        )}
        {intentEmoji && (
          <View
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              backgroundColor: "#fff",
              borderRadius: 8,
              width: 16,
              height: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 10, lineHeight: 14 }}>{intentEmoji}</Text>
          </View>
        )}
      </View>
      <Text
        className="text-[9px] text-muted-foreground mt-0.5"
        numberOfLines={1}
      >
        {displayName || "Anon"}
      </Text>
    </Pressable>
  );
}

export default function PeopleStrip({
  plusCode,
  signalMode,
  onToggleSignalMode,
  canPost,
}: {
  plusCode: string;
  signalMode?: boolean;
  onToggleSignalMode?: () => void;
  canPost?: boolean;
}) {
  const events = useAppSelector(mapSelectors.selectEventsForSelectedMapLayer);
  const [expandedPubkey, setExpandedPubkey] = useState<string | null>(null);

  const activeSignals = useMemo(() => {
    const { eventsForPlusCodeExactly, eventsWithinPlusCode } =
      filterEventsForPlusCode(events, plusCode);
    const allEvents = [...eventsForPlusCodeExactly, ...eventsWithinPlusCode];
    return getActiveSignals(allEvents);
  }, [events, plusCode]);

  const expandedSignal = useMemo(
    () =>
      expandedPubkey
        ? activeSignals.find(
            (s) => getAuthorFromEvent(s.event) === expandedPubkey,
          )
        : undefined,
    [activeSignals, expandedPubkey],
  );

  // Show strip if there are signals or if user can post (so "+" is visible)
  if (activeSignals.length === 0 && !canPost) return null;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-4 py-2 gap-3"
        className="border-b border-border/20"
      >
        {activeSignals.map((signal) => {
          const pubkey = getAuthorFromEvent(signal.event);
          return (
            <PersonBubble
              key={pubkey}
              signal={signal}
              isExpanded={expandedPubkey === pubkey}
              onPress={() =>
                setExpandedPubkey(
                  expandedPubkey === pubkey ? null : (pubkey ?? null),
                )
              }
            />
          );
        })}

        {/* Add signal bubble */}
        {canPost && (
          <Pressable
            onPress={onToggleSignalMode}
            className="items-center"
            style={{ width: 56 }}
            accessibilityLabel={signalMode ? "Cancel signal" : "Add yourself"}
            accessibilityRole="button"
          >
            <View
              className={`h-11 w-11 items-center justify-center rounded-full border-2 border-dashed ${
                signalMode
                  ? "border-primary bg-primary/15"
                  : "border-muted-foreground/30 bg-muted/10"
              }`}
            >
              <Icon
                as={signalMode ? Minus : Plus}
                size={20}
                className={
                  signalMode ? "text-primary" : "text-muted-foreground/50"
                }
              />
            </View>
            <Text className="text-[9px] text-muted-foreground mt-0.5">
              {signalMode ? "Cancel" : "I'm here"}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {expandedSignal && (
        <SignalMiniCard
          signal={expandedSignal}
          onClose={() => setExpandedPubkey(null)}
        />
      )}
    </View>
  );
}
