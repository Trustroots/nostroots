import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { settingsSelectors } from "@/redux/slices/settings.slice";
import { MAP_LAYER_KEY, MAP_LAYERS, MapLayer } from "@trustroots/nr-common";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useColorScheme } from "nativewind";
import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";

const PRIMARY_COLOR = "#12a585";
const LIGHT_INACTIVE_COLOR = "#687076";
const DARK_INACTIVE_COLOR = "#9BA1A6";
const LIGHT_ACTIVE_BG = "#e6f7f4";
const DARK_ACTIVE_BG = "#1a3330";

// filter out these note types if test features are disabled
const TEST_FEATURE_LAYERS: MAP_LAYER_KEY[] = ["timesafari", "triphopping"];

export default function MapLayerSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { top } = useSafeAreaInsets();

  const selectedLayer = useAppSelector(mapSelectors.selectSelectedLayer);
  const areTestFeaturesEnabled = useAppSelector(
    settingsSelectors.selectAreTestFeaturesEnabled,
  );
  const dispatch = useAppDispatch();

  const filteredMapLayers = useMemo(() => {
    if (areTestFeaturesEnabled) {
      return Object.entries(MAP_LAYERS) as [MAP_LAYER_KEY, MapLayer][];
    } else {
      return Object.entries(MAP_LAYERS).filter(([key]) => {
        return !TEST_FEATURE_LAYERS.includes(key as MAP_LAYER_KEY);
      }) as [MAP_LAYER_KEY, MapLayer][];
    }
  }, [areTestFeaturesEnabled]);

  const selectedLayerTitle = MAP_LAYERS[selectedLayer]?.title ?? "Select Layer";

  const handleSelectLayer = (key: MAP_LAYER_KEY) => {
    dispatch(mapActions.toggleLayer(key));
    setIsOpen(false);
  };

  const iconColor = isDark ? DARK_INACTIVE_COLOR : "#ffffff";
  const activeBgColor = isDark ? DARK_ACTIVE_BG : LIGHT_ACTIVE_BG;
  const activeTextColor = PRIMARY_COLOR;
  const inactiveTextColor = isDark ? DARK_INACTIVE_COLOR : LIGHT_INACTIVE_COLOR;

  return (
    <View
      className="absolute left-2.5"
      style={{ top: top + 10 }}
      pointerEvents="box-none"
    >
      <Pressable
        className="flex-row items-center gap-2 self-start rounded-full bg-black/50 px-3 py-2"
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text className="text-white font-medium">{selectedLayerTitle}</Text>
        <Ionicons
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={16}
          color={iconColor}
        />
      </Pressable>

      {isOpen && (
        <>
          <Pressable
            className="absolute -left-10 -top-10 h-screen w-screen"
            onPress={() => setIsOpen(false)}
          />
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(100)}
            className="absolute left-0 top-full mt-2 overflow-hidden rounded-2xl bg-background shadow"
          >
            {filteredMapLayers.map(([key, config]) => {
              const isSelected = key === selectedLayer;
              return (
                <Pressable
                  key={key}
                  className="flex-row items-center gap-3 px-4 py-3"
                  style={
                    isSelected ? { backgroundColor: activeBgColor } : undefined
                  }
                  onPress={() => handleSelectLayer(key)}
                >
                  <View
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: config.markerColor }}
                  />
                  <Text
                    style={{
                      color: isSelected ? activeTextColor : inactiveTextColor,
                      fontWeight: isSelected ? "600" : "400",
                    }}
                  >
                    {config.title}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={activeTextColor}
                      style={{ marginLeft: "auto" }}
                    />
                  )}
                </Pressable>
              );
            })}
          </Animated.View>
        </>
      )}
    </View>
  );
}
