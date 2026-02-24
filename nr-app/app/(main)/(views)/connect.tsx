import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { sendConnectResponse } from "@/nostr/nip-46.nostr";
import { Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, TextInput } from "react-native";
import "react-native-get-random-values";

export default function TabFourScreen() {
  const [connectURI, setConnectURI] = useState("");

  return (
    <ScrollView contentContainerClassName="px-safe-offset-4 pb-safe-offset-6 bg-background h-full">
      <Stack.Screen
        options={{
          title: "NIP-46 Connect",
        }}
      />

      <Text variant="muted">nostrconnect:// url</Text>
      <TextInput
        style={styles.input}
        value={connectURI}
        onChangeText={setConnectURI}
      />
      <Button
        title="Send connect response"
        onPress={async () => {
          __DEV__ && console.log("#OQ7VsC Sending connect response…");
          await sendConnectResponse(connectURI);
        }}
      />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
  },
});
