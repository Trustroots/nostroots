import { sendConnectResponse } from "@/nostr/nip-46.nostr";
import { useState } from "react";
import {
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import "react-native-get-random-values";

export default function TabFourScreen() {
  const [connectURI, setConnectURI] = useState("");

  return (
    <SafeAreaView style={styles.settings}>
      <ScrollView>
        <Text style={styles.header}>NIP-46 Connect</Text>
        <Text style={styles.settings}>nostrconnect:// url</Text>
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
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  settings: { backgroundColor: "#ffffff" },
  q: {
    fontSize: 15,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 10,
  },
  a: {
    marginBottom: 10,
    marginTop: 10,
  },
  header: {
    backgroundColor: "#f8f8f8",
    fontSize: 24,
    fontWeight: "bold",
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
  },
});
