import * as Clipboard from "expo-clipboard";
import { Stack, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { useDebugInfo } from "@/hooks/useDebugInfo";
import { signEventTemplate } from "@/nostr/keystore.nostr";
import { sendSupportMessage } from "@/services/nrBridge.service";
import {
  formatSupportMessage,
  getUserMessageBudget,
  MIN_USER_MESSAGE_LENGTH,
  TRUSTROOTS_SUPPORT_URL,
} from "@/utils/debugInfo.utils";

export default function FeedbackScreen() {
  const router = useRouter();
  const debugInfo = useDebugInfo();
  const [userMessage, setUserMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isDisclosureOpen, setIsDisclosureOpen] = useState(false);

  const budget = getUserMessageBudget(debugInfo);
  const trimmedLength = userMessage.trim().length;
  const isLongEnough = trimmedLength >= MIN_USER_MESSAGE_LENGTH;
  const remaining = budget - userMessage.length;

  const handleSubmit = async () => {
    const message = formatSupportMessage({ userMessage, debugInfo });

    setIsSending(true);
    try {
      await sendSupportMessage({ message, sign: signEventTemplate });
      Alert.alert(
        "Thanks!",
        "We sent your feedback to Trustroots support. If you are waiting on a reply, check the email address on your Trustroots account.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch {
      await Clipboard.setStringAsync(message);
      Alert.alert(
        "Could not send",
        "We could not reach support, so we copied your message to the clipboard instead. Paste it into the support form so we can see what went wrong.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Open support",
            onPress: () => {
              WebBrowser.openBrowserAsync(TRUSTROOTS_SUPPORT_URL);
            },
          },
        ],
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScrollView contentContainerClassName="px-safe-offset-4 pb-safe-offset-6 bg-background">
      <Stack.Screen options={{ title: "Send feedback" }} />

      <Section>
        <Text variant="p">
          Tell us what is going wrong, or what you would like to see. This goes
          to the Trustroots team.
        </Text>

        <TextInput
          multiline
          autoFocus
          value={userMessage}
          onChangeText={setUserMessage}
          maxLength={budget}
          placeholder="What happened?"
          placeholderTextColor="#9BA1A6"
          className="border border-border rounded px-3 py-2 bg-background text-foreground min-h-32"
          textAlignVertical="top"
        />

        {isLongEnough ? (
          remaining <= 200 ? (
            <Text variant="small" className="text-muted-foreground">
              {remaining} characters left
            </Text>
          ) : null
        ) : (
          <Text variant="small" className="text-muted-foreground">
            {MIN_USER_MESSAGE_LENGTH} character minimum
          </Text>
        )}

        <Button
          variant="ghost"
          onPress={() => setIsDisclosureOpen(!isDisclosureOpen)}
          className="justify-start px-0"
        >
          <Text>What we send with this</Text>
        </Button>

        {isDisclosureOpen ? (
          <View className="bg-muted rounded-lg p-4">
            <Text variant="small" className="font-mono">
              {debugInfo}
            </Text>
          </View>
        ) : null}

        <Button
          size="lg"
          onPress={handleSubmit}
          disabled={!isLongEnough || isSending}
          accessibilityLabel="Send feedback"
        >
          {isSending ? <ActivityIndicator size="small" /> : null}
          <Text>{isSending ? "Sending…" : "Send feedback"}</Text>
        </Button>
      </Section>
    </ScrollView>
  );
}
