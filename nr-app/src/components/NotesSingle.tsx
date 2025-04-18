import { useAppSelector } from "@/redux/hooks";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import { RootState } from "@/redux/store";
import {
  getAuthorFromEvent,
  getTrustrootsUsernameFromProfileEvent,
} from "@trustroots/nr-common";
import { useMemo } from "react";
import { Text, View } from "react-native";

function NoteAuthorInfo({ authorPublicKey }: { authorPublicKey?: string }) {
  const selectTrustrootsUsername = useMemo(
    () => eventsSelectors.selectTrustrootsUsernameFactory(authorPublicKey),
    [authorPublicKey],
  );
  const username = useAppSelector(selectTrustrootsUsername);

  return (
    <View>
      <Text>Username: {username}</Text>
    </View>
  );
}

export default function NotesSingle({
  eventWithMetadata,
}: {
  eventWithMetadata: EventWithMetadata;
}) {
  const authorPublicKey = getAuthorFromEvent(eventWithMetadata.event);

  return (
    <View>
      <Text>Note ID: {eventWithMetadata.event.id}</Text>
      <Text>Content: {eventWithMetadata.event.content}</Text>
      <NoteAuthorInfo authorPublicKey={authorPublicKey} />
    </View>
  );
}
