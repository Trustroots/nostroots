import Ionicons from "@expo/vector-icons/Ionicons";
import { Slot, useRouter, usePathname } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { ROUTES } from "@/constants/routes";
import { useColorScheme } from "@/hooks/useColorScheme";

const PRIMARY_COLOR = "#12a585";

export default function MapLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();

  const isDark = colorScheme === "dark";
  const inactiveColor = isDark ? "#9BA1A6" : "#687076";
  const activeBgColor = isDark ? "#1a3330" : "#e6f7f4";

  // Overlay button colors
  const overlayBgColor = isDark
    ? "rgba(0, 0, 0, 0.6)"
    : "rgba(255, 255, 255, 0.9)";
  const overlayIconColor = isDark ? "#ffffff" : "#374151";

  const isMapActive = pathname === "/" || pathname === "/index";
  const isListActive = pathname === "/list";

  return (
    <View className="flex-1">
      <Slot />

      {/* Overlay buttons */}
      <View
        className="absolute right-2.5 flex-row gap-2 z-10"
        style={{ top: insets.top + 10 }}
      >
        <Pressable
          onPress={() => router.push(ROUTES.CONNECT)}
          className="w-11 h-11 rounded-full items-center justify-center"
          style={{ backgroundColor: overlayBgColor }}
        >
          <Ionicons name="key-outline" size={22} color={overlayIconColor} />
        </Pressable>
        <Pressable
          onPress={() => router.push(ROUTES.SETTINGS)}
          className="w-11 h-11 rounded-full items-center justify-center"
          style={{ backgroundColor: overlayBgColor }}
        >
          <Ionicons
            name="settings-outline"
            size={22}
            color={overlayIconColor}
          />
        </Pressable>
      </View>

      {/* Navigation pills */}
      <View
        className="absolute self-center flex-row gap-3 p-3 rounded-full bg-background shadow-xl z-10"
        style={{ bottom: insets.bottom + 20 }}
      >
        <Pressable
          className="flex-row items-center gap-2 px-4 py-3 rounded-full"
          style={isMapActive ? { backgroundColor: activeBgColor } : undefined}
          onPress={() => router.replace(ROUTES.HOME)}
        >
          <Ionicons
            name={isMapActive ? "map" : "map-outline"}
            size={20}
            color={isMapActive ? PRIMARY_COLOR : inactiveColor}
          />
          <Text
            className="font-medium text-[15px]"
            style={{ color: isMapActive ? PRIMARY_COLOR : inactiveColor }}
          >
            Map
          </Text>
        </Pressable>
        <Pressable
          className="flex-row items-center gap-2 px-4 py-3 rounded-full"
          style={isListActive ? { backgroundColor: activeBgColor } : undefined}
          onPress={() => router.replace(ROUTES.LIST)}
        >
          <Ionicons
            name={isListActive ? "list" : "list-outline"}
            size={20}
            color={isListActive ? PRIMARY_COLOR : inactiveColor}
          />
          <Text
            className="font-medium text-[15px]"
            style={{ color: isListActive ? PRIMARY_COLOR : inactiveColor }}
          >
            List
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
