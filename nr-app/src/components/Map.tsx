import React, { lazy, Suspense } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAppSelector } from "@/redux/hooks";
import { settingsSelectors } from "@/redux/slices/settings.slice";
import HalfMapEventModal from "./HalfMapEventModal";
import MapAddNoteModal from "./MapAddNoteModal";
import MapLayerSelector from "./MapLayerSelector";
import MapModal from "./MapModal";
import MapPlusCodes from "./MapPlusCodes";

const MapLibreMapView = lazy(() => import("./MapLibreMapView"));

export default function Map() {
  const useMapLibre = useAppSelector(settingsSelectors.selectUseMapLibre);

  return (
    <View style={{ flex: 1 }}>
      <View className="flex-1">
        {useMapLibre ? (
          <Suspense
            fallback={
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator />
              </View>
            }
          >
            <MapLibreMapView />
          </Suspense>
        ) : (
          <MapPlusCodes />
        )}
        <MapLayerSelector />
      </View>
      {/* This should be removed and deleted once the plus code map goes live */}
      <MapAddNoteModal />
      <MapModal />
      <HalfMapEventModal />
    </View>
  );
}
