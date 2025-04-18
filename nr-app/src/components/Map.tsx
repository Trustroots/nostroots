import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { settingsSelectors } from "@/redux/slices/settings.slice";
import { MAP_LAYER_KEY, MAP_LAYERS, MapLayer } from "@trustroots/nr-common";
import React, { useMemo } from "react";
import { FlatList, StyleSheet, Switch, Text, View } from "react-native";
import MapAddNoteModal from "./MapAddNoteModal";
import { MapMarkers } from "./MapMarkers";
import MapPlusCodes from "./MapPlusCodes";
import MapModal from "./MapModal";

// filter out these note types if test features are disabled
const TEST_FEATURE_LAYERS: MAP_LAYER_KEY[] = ["timesafari", "triphopping"];

export default function Map() {
  const enabledLayers = useAppSelector(mapSelectors.selectEnabledLayers);
  const areTestFeaturesEnabled = useAppSelector(
    settingsSelectors.selectAreTestFeaturesEnabled,
  );
  const enablePlusCodeMapTEMPORARY = useAppSelector(
    mapSelectors.selectEnablePlusCodeMapTEMPORARY,
  );
  const dispatch = useAppDispatch();

  __DEV__ && console.log("#iNicG9 Map.tsx / render()", Date.now());

  // Filter MAP_LAYERS based on areTestFeaturesEnabled
  const filteredMapLayers = useMemo(() => {
    if (areTestFeaturesEnabled) {
      // If test features are enabled, show all layers
      return Object.entries(MAP_LAYERS) as [MAP_LAYER_KEY, MapLayer][];
    } else {
      // If test features are disabled, filter out certain layers
      return Object.entries(MAP_LAYERS).filter(([key]) => {
        return !TEST_FEATURE_LAYERS.includes(key as MAP_LAYER_KEY);
      }) as [MAP_LAYER_KEY, MapLayer][];
    }
  }, [areTestFeaturesEnabled]);

  return (
    <View style={styles.mapContainer}>
      {enablePlusCodeMapTEMPORARY ? <MapPlusCodes /> : <MapMarkers />}

      <View style={styles.toggleWrapper}>
        <FlatList
          data={filteredMapLayers}
          keyExtractor={([key]) => key}
          renderItem={({ item: [key, config] }) => (
            <View style={styles.toggleContainer}>
              <Switch
                value={enabledLayers[key]}
                onValueChange={() => void dispatch(mapActions.toggleLayer(key))}
              />
              <Text style={styles.layerToggle}> {config.title} </Text>
            </View>
          )}
        />
      </View>

      {/* This should be removed and deleted once the plus code map goes live */}
      <MapAddNoteModal />
      <MapModal />
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
  },
  toggleWrapper: { position: "absolute", top: 40, left: 10, zIndex: 1 },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  layerToggle: {
    color: "rgba(255,255,255,1)",
    backgroundColor: "rgba(10, 10, 0, 0.2)",
  },
});
