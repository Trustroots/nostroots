import * as Clipboard from "expo-clipboard";
import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Copy, ExternalLink } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import Toast from "react-native-root-toast";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { useDebugInfo } from "@/hooks/useDebugInfo";
import { useThemeColors } from "@/hooks/useThemeColors";
import { TRUSTROOTS_SUPPORT_URL } from "@/utils/debugInfo.utils";

export default function SupportScreen() {
  const colors = useThemeColors();
  const debugInfo = useDebugInfo();

  const copyDebugInfo = async () => {
    await Clipboard.setStringAsync(debugInfo);
    Toast.show("Debug info copied", { duration: Toast.durations.SHORT });
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <Stack.Screen options={{ title: "Contact support" }} />

      <View className="w-full max-w-2xl self-center px-safe-offset-4 pb-safe-offset-6">
        <Section>
          <Text variant="p">
            Having trouble, or want to share feedback? Copy the debug info
            below, open the Trustroots support page, and paste it into your
            message. It helps us see which version of the app you are using.
          </Text>

          <View className="border border-border rounded-md p-3">
            <Text
              selectable
              variant="muted"
              className="font-mono text-xs leading-5"
            >
              {debugInfo}
            </Text>
          </View>

          <Button variant="outline" size="lg" onPress={copyDebugInfo}>
            <Icon as={Copy} size={16} className="text-foreground" />
            <Text>Copy debug info</Text>
          </Button>

          <Button
            size="lg"
            onPress={() => WebBrowser.openBrowserAsync(TRUSTROOTS_SUPPORT_URL)}
          >
            <Icon
              as={ExternalLink}
              size={16}
              className="text-primary-foreground"
            />
            <Text>Open Trustroots support</Text>
          </Button>
        </Section>
      </View>
    </ScrollView>
  );
}
