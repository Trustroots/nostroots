import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { sendConnectResponse } from "@/nostr/nip-46.nostr";
import { useState } from "react";
import { ScrollView, StyleSheet, TextInput } from "react-native";
import "react-native-get-random-values";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TabFourScreen() {
  const [connectURI, setConnectURI] = useState("");

  return (
    <ScrollView contentContainerClassName="p-safe-offset-4 bg-white h-full">
      <Text variant="h1">NIP-46 Connect</Text>
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
