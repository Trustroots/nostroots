import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { sendConnectResponse } from "@/nostr/nip-46.nostr";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, TextInput } from "react-native";
import "react-native-get-random-values";

export default function TabFourScreen() {
  const [connectURI, setConnectURI] = useState("");
  const colors = useThemeColors();

  return (
    <ScrollView contentContainerClassName="px-safe-offset-4 pb-safe-offset-6 bg-background h-full">
      <Stack.Screen
        options={{
          title: "NIP-46 Connect",
        }}
      />

      <Text variant="muted">nostrconnect:// url</Text>
      <TextInput
        className="h-10 mb-5 px-3 border border-border rounded bg-background text-foreground"
        placeholderTextColor={colors.mutedForeground}
        value={connectURI}
        onChangeText={setConnectURI}
      />
      <Button
        title="Send connect response"
        onPress={async () => {
          await sendConnectResponse(connectURI);
        }}
      />
    </ScrollView>
  );
}
