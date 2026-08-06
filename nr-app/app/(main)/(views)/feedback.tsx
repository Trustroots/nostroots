import * as Clipboard from "expo-clipboard";
import { Stack, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { useDebugInfo } from "@/hooks/useDebugInfo";
import { useThemeColors } from "@/hooks/useThemeColors";
import { signEventTemplate } from "@/nostr/keystore.nostr";
import { sendSupportMessage } from "@/services/nrBridge.service";
import { cn } from "@/utils/cn.utils";
import {
  formatSupportMessage,
  MAX_USER_MESSAGE_LENGTH,
  MIN_USER_MESSAGE_LENGTH,
  TRUSTROOTS_SUPPORT_URL,
} from "@/utils/debugInfo.utils";

/** Far enough out that the warning is a heads-up, not a surprise. */
const LIMIT_WARNING_THRESHOLD = 50;

export default function FeedbackScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const debugInfo = useDebugInfo();
  const [userMessage, setUserMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isDisclosureOpen, setIsDisclosureOpen] = useState(false);

  const length = userMessage.length;
  const remaining = MAX_USER_MESSAGE_LENGTH - length;
  const isLongEnough = userMessage.trim().length >= MIN_USER_MESSAGE_LENGTH;
  const isOverLimit = remaining < 0;

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
      setUserMessage("");
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
    <KeyboardAwareScrollView
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <Stack.Screen options={{ title: "Send feedback" }} />

      <View className="w-full max-w-2xl self-center px-safe-offset-4 pb-safe-offset-6">
        <Section>
          <Text variant="p">
            Tell us what is going wrong, or what you would like to see. This
            goes to the Trustroots team.
          </Text>

          <TextInput
            multiline
            autoFocus
            value={userMessage}
            onChangeText={setUserMessage}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="What happened?"
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel="Your feedback"
            accessibilityHint={`Between ${MIN_USER_MESSAGE_LENGTH} and ${MAX_USER_MESSAGE_LENGTH} characters.`}
            className={cn(
              "border rounded-md px-3 py-3 bg-background text-foreground text-base min-h-32",
              isOverLimit
                ? "border-destructive"
                : isFocused
                  ? "border-primary"
                  : "border-border",
            )}
            textAlignVertical="top"
          />

          <View
            accessibilityLiveRegion="polite"
            className="h-5 flex-row items-center gap-4"
          >
            {isLongEnough ? null : (
              <Text
                variant="small"
                className="text-muted-foreground font-normal"
              >
                {MIN_USER_MESSAGE_LENGTH} characters minimum
              </Text>
            )}

            <View className="flex-1" />

            {remaining <= LIMIT_WARNING_THRESHOLD ? (
              <Text
                variant="small"
                accessibilityLabel={`${length} of ${MAX_USER_MESSAGE_LENGTH} characters`}
                className={isOverLimit ? "text-destructive" : "text-foreground"}
              >
                {length}/{MAX_USER_MESSAGE_LENGTH}
              </Text>
            ) : null}
          </View>

          <Button
            size="lg"
            className="mt-2"
            onPress={handleSubmit}
            disabled={!isLongEnough || isOverLimit || isSending}
            accessibilityLabel="Send feedback"
            accessibilityHint={
              isLongEnough
                ? isOverLimit
                  ? `Shorten your message to ${MAX_USER_MESSAGE_LENGTH} characters or fewer.`
                  : undefined
                : `Write at least ${MIN_USER_MESSAGE_LENGTH} characters first.`
            }
          >
            {isSending ? <ActivityIndicator size="small" /> : null}
            <Text>{isSending ? "Sending…" : "Send feedback"}</Text>
          </Button>

          <Collapsible
            open={isDisclosureOpen}
            onOpenChange={setIsDisclosureOpen}
          >
            <CollapsibleTrigger
              hitSlop={12}
              accessibilityLabel="What we send with this"
              className="flex-row items-center gap-1 self-start py-3 active:opacity-60"
            >
              <Icon
                as={isDisclosureOpen ? ChevronDown : ChevronRight}
                size={14}
                className="text-muted-foreground"
              />
              <Text variant="muted">What we send with this</Text>
            </CollapsibleTrigger>

            <CollapsibleContent className="border border-border rounded-md p-3">
              <Text
                selectable
                variant="muted"
                className="font-mono text-xs leading-5"
              >
                {debugInfo}
              </Text>
            </CollapsibleContent>
          </Collapsible>
        </Section>
      </View>
    </KeyboardAwareScrollView>
  );
}
