import React from "react";
import { View } from "react-native";

import { TEST_IDS } from "@/constants/testIds";

import HalfMapEventModal from "./HalfMapEventModal";
import MapAddNoteModal from "./MapAddNoteModal";
import MapLayerSelector from "./MapLayerSelector";
import MapLibreMapView from "./MapLibreMapView";
import MapModal from "./MapModal";

export default function Map() {
  return (
    <View testID={TEST_IDS.map.screen} style={{ flex: 1 }}>
      <View className="flex-1">
        <MapLibreMapView />
        <MapLayerSelector />
      </View>
      <MapAddNoteModal />
      <MapModal />
      <HalfMapEventModal />
    </View>
  );
}
