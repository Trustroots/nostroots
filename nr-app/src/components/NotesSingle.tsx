import { useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import { getAuthorFromEvent } from "@trustroots/nr-common";
import { useMemo } from "react";
import { View } from "react-native";
import { ExternalLink } from "./ExternalLink";
import { Section } from "./ui/section";
import { Text } from "./ui/text";

function NoteAuthorInfo({ authorPublicKey }: { authorPublicKey?: string }) {
  const selectTrustrootsUsername = useMemo(
    () => eventsSelectors.selectTrustrootsUsernameFactory(authorPublicKey),
    [authorPublicKey],
  );
  const username = useAppSelector(selectTrustrootsUsername);

  if (typeof username === "undefined") {
    return (
      <View className="flex-row items-center space-x-2">
        <Text variant="muted">– "Anonymous"</Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center space-x-2">
      <Text variant="muted">
        {"- "}
        <ExternalLink href={`http://trustroots.org/profile/${username}`}>
          {username}
        </ExternalLink>
      </Text>
    </View>
  );
}

export default function NotesSingle({
  eventWithMetadata,
  isSelected,
}: {
  eventWithMetadata: EventWithMetadata;
  isSelected: boolean;
}) {
  const authorPublicKey = getAuthorFromEvent(eventWithMetadata.event);

  return (
    <Section
      className={`px-4 pb-4 bg-white rounded-lg border ${isSelected ? "border-red-500" : "border-gray-200"}`}
    >
      <Text variant="p">{eventWithMetadata.event.content}</Text>
      <View className="mb-2">
        <NoteAuthorInfo authorPublicKey={authorPublicKey} />
      </View>
      <Text variant="muted" className="text-xs text-gray-500 font-mono">
        ID: {eventWithMetadata.event.id.slice(0, 24)}...
      </Text>
    </Section>
  );
}
