import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, StyleSheet, Text, ScrollView, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { addEvent, eventsSelectors } from "@/redux/slices/events.slice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { Relay, finalizeEvent, verifyEvent } from "nostr-tools";
import { hexToBytes } from "@noble/hashes/utils";
import { generateSeedWords, accountFromSeedWords } from "nip06";

export default function TabTwoScreen() {
  const events = useAppSelector(eventsSelectors.selectAll);
  const dispatch = useAppDispatch();

  return (
    <ScrollView
      headerBackgroundColor={{ light: "#D0D0D0", dark: "#353636" }}
      headerImage={
        <Ionicons size={310} name="code-slash" style={styles.headerImage} />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Stream of notes</ThemedText>
      </ThemedView>
      <View>
        <Button
          title="Load 10 notes"
          onPress={async () => {
            const { mnemonic } = generateSeedWords();
            const account = accountFromSeedWords({ mnemonic });
            console.log("#0GAjcE Generated seed and private key", {
              mnemonic,
              account,
            });
            const eventTemplate = {
              kind: 0,
              created_at: Math.round(Date.now() / 1e3),
              content: JSON.stringify({ name: "Aarhus" }),
              tags: [],
            };
            const event = finalizeEvent(
              eventTemplate,
              hexToBytes(account.privateKey.hex),
            );
            console.log("#cBiwGN Signed event", event);
            const verificationResult = verifyEvent(event);
            console.log("#QPwp7w Verification result", verificationResult);

            const relay = new Relay("wss://nos.lol");
            await relay.connect();
            const sub = relay.subscribe([{ kinds: [397], limit: 10 }], {
              onevent: (event) =>
                void dispatch(
                  addEvent({
                    event,
                    fromRelay: "wss://nos.lol",
                  }),
                ),
              oneose: () => {
                sub.close();
              },
            });
          }}
        />
      </View>
      <View>
        <Text style={{ color: "#880088" }}>
          We have a total of {events.length} notes.
        </Text>
        {events.map((event) => (
          <View key={event.event.id}>
            <Text style={{ color: "#008800" }}>{event.event.content}</Text>
            <Text style={{ color: "#008800" }}>
              {new Date(event.event.created_at * 1000).toLocaleString()}
            </Text>
            <Text style={{ color: "#008800" }}>{event.event.pubkey}</Text>
            <Text style={{ color: "#008800" }}>
              {Array.isArray(event.event.tags[1]) && event.event.tags[1][1]
                ? JSON.stringify(event.event.tags[1][1])
                : null}
            </Text>
            <Text style={{ color: "#008800" }}>----------------------</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    gap: 8,
  },
});
