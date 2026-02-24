import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { settingsSelectors } from "@/redux/slices/settings.slice";
import { MAP_LAYER_KEY, MAP_LAYERS, MapLayer } from "@trustroots/nr-common";
import React, { useMemo } from "react";
import { FlatList, Switch, View } from "react-native";

import { Text } from "@/components/ui/text";
import HalfMapEventModal from "./HalfMapEventModal";
import MapAddNoteModal from "./MapAddNoteModal";
import MapModal from "./MapModal";
import MapPlusCodes from "./MapPlusCodes";

// filter out these note types if test features are disabled
const TEST_FEATURE_LAYERS: MAP_LAYER_KEY[] = ["timesafari", "triphopping"];

export default function Map() {
  const enabledLayers = useAppSelector(mapSelectors.selectEnabledLayers);
  const areTestFeaturesEnabled = useAppSelector(
    settingsSelectors.selectAreTestFeaturesEnabled,
  );
  const dispatch = useAppDispatch();

  // Filter MAP_LAYERS based on areTestFeaturesEnabled
  const filteredMapLayers = useMemo(() => {
    if (areTestFeaturesEnabled) {
      return Object.entries(MAP_LAYERS) as [MAP_LAYER_KEY, MapLayer][];
    } else {
      return Object.entries(MAP_LAYERS).filter(([key]) => {
        return !TEST_FEATURE_LAYERS.includes(key as MAP_LAYER_KEY);
      }) as [MAP_LAYER_KEY, MapLayer][];
    }
  }, [areTestFeaturesEnabled]);

  return (
    <>
      <View className="flex-1">
        <MapPlusCodes />

        <View className="absolute top-16 left-2.5">
          <FlatList
            data={filteredMapLayers}
            keyExtractor={([key]) => key}
            renderItem={({ item: [key, config] }) => (
              <View className="flex-row items-center p-2.5 bg-black/30">
                <Switch
                  value={enabledLayers[key]}
                  onValueChange={() =>
                    void dispatch(mapActions.toggleLayer(key))
                  }
                />
                <Text className="text-white bg-black/20"> {config.title} </Text>
              </View>
            )}
          />
        </View>
      </View>
      {/* This should be removed and deleted once the plus code map goes live */}
      <MapAddNoteModal />
      <MapModal />
      <HalfMapEventModal />
    </>
  );
}
