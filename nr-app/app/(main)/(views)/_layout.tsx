import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackHeaderProps } from "@react-navigation/native-stack";
import { Stack, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/hooks/useColorScheme";

function CustomHeader({ options }: NativeStackHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const title =
    typeof options.headerTitle === "string"
      ? options.headerTitle
      : (options.title ?? "");

  return (
    <View
      className="bg-background px-4 pb-4"
      style={{ paddingTop: insets.top + 12 }}
    >
      <View className="flex-row items-center gap-4">
        <Pressable
          onPress={() => router.back()}
          className="w-12 h-12 rounded-full bg-muted items-center justify-center active:opacity-70"
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDark ? "#fafafa" : "#0a0a0a"}
          />
        </Pressable>
        <Text variant="h1" className="my-0 flex-1">
          {title}
        </Text>
      </View>
    </View>
  );
}

export default function ViewsLayout() {
  return (
    <Stack
      screenOptions={{
        header: (props) => <CustomHeader {...props} />,
      }}
    />
  );
}
