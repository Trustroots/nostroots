import { subscribeToPlusCode } from "@/redux/actions/notifications.actions";
import { useAppDispatch } from "@/redux/hooks";
import { PlusCode } from "@trustroots/nr-common";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import Toast from "react-native-root-toast";
import { Button } from "./ui/button";
import { Text } from "./ui/text";

function getCoverageDescription(plusCode: PlusCode): string {
  const effectiveLength = plusCode.replace("+", "").replace(/0+$/, "").length;
  const normalized = Math.min(
    8,
    Math.max(2, Math.floor(effectiveLength / 2) * 2),
  );

  switch (normalized) {
    case 2:
      return "continental region (~2800km)";
    case 4:
      return "city-sized region (~110km)";
    case 6:
      return "neighborhood (~5.5km)";
    default:
      return "block (~275m)";
  }
}

interface SubscriptionPromptProps {
  plusCode: PlusCode;
  onSubscribe?: () => void;
  onSkip?: () => void;
}

export default function SubscriptionPrompt({
  plusCode,
  onSubscribe,
  onSkip,
}: SubscriptionPromptProps) {
  const dispatch = useAppDispatch();
  const [isSubscribing, setIsSubscribing] = useState(false);

  const coverageDescription = getCoverageDescription(plusCode);

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      await dispatch(subscribeToPlusCode(plusCode));
      Toast.show("Subscribed to notifications", {
        duration: Toast.durations.LONG,
        position: Toast.positions.TOP,
      });
      onSubscribe?.();
    } catch (error) {
      Toast.show(
        `#hK7nPq Error: ${error instanceof Error ? error.message : String(error)}`,
        {
          duration: Toast.durations.LONG,
          position: Toast.positions.TOP,
        },
      );
      setIsSubscribing(false);
    }
  };

  const handleSkip = () => {
    onSkip?.();
  };

  return (
    <View className="w-full bg-card p-4 rounded-lg items-center gap-3">
      <Text variant="h4">Get notified about this area?</Text>
      <Text className="text-center text-muted-foreground">
        You'll receive notifications when new notes are posted in this{" "}
        {coverageDescription}.
      </Text>
      <View className="w-full flex-row justify-center gap-4 mt-2">
        <Button
          title={isSubscribing ? "" : "Yes, subscribe"}
          onPress={handleSubscribe}
          disabled={isSubscribing}
          className="flex-1"
        >
          {isSubscribing && <ActivityIndicator color="white" />}
        </Button>
        <Button
          title="Not now"
          variant="outline"
          onPress={handleSkip}
          disabled={isSubscribing}
          className="flex-1"
        />
      </View>
    </View>
  );
}
