import React from "react";
import { View } from "react-native";

import HalfMapEventModal from "./HalfMapEventModal";
import MapAddNoteModal from "./MapAddNoteModal";
import MapLayerSelector from "./MapLayerSelector";
import MapModal from "./MapModal";
import MapPlusCodes from "./MapPlusCodes";

export default function Map() {
  return (
    <>
      <View className="flex-1">
        <MapPlusCodes />
        <MapLayerSelector />
      </View>
      {/* This should be removed and deleted once the plus code map goes live */}
      <MapAddNoteModal />
      <MapModal />
      <HalfMapEventModal />
    </>
  );
}
