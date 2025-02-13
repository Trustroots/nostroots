import { FlatList, StyleSheet, Switch, Text, View } from "react-native";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { MAP_LAYER_KEY, MAP_LAYERS, MapLayer } from "@trustroots/nr-common";
import React from "react";
import { MapMarkers } from "./MapMarkers";
import MapModal from "./MapModal";

export default function Map() {
  const enabledLayers = useAppSelector(mapSelectors.selectEnabledLayers);
  const dispatch = useAppDispatch();

  __DEV__ && console.log("#iNicG9 Map.tsx / render()", Date.now());

  return (
    <View style={styles.mapContainer}>
      <MapMarkers />
      <View style={styles.toggleWrapper}>
        <FlatList
          data={Object.entries(MAP_LAYERS) as [MAP_LAYER_KEY, MapLayer][]}
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
