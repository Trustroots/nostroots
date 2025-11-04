import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions } from "@/redux/slices/map.slice";
import { rootLogger } from "@/utils/logger.utils";
import {
  allPlusCodesForRegion,
  plusCodeToRectangle,
  regionToBoundingBox,
} from "@/utils/map.utils";
import {
  FillLayer,
  MapView,
  MapViewRef,
  ShapeSource,
} from "@maplibre/maplibre-react-native";
import React, { useMemo, useRef } from "react";
import { Region } from "react-native-maps";
import { selectPlusCodesWithState } from "./MapPlusCodes";

const log = rootLogger.extend("MaplibreView");

export default function MaplibreView({
  enablePlusCodes,
}: {
  enablePlusCodes: boolean;
}) {
  const dispatch = useAppDispatch();
  const plusCodesWithState = useAppSelector(selectPlusCodesWithState);

  const map = useRef<MapViewRef>(null);

  const handleMapRegionChange = useMemo(
    () =>
      function handleMapRegionChangeHandler(feature: any) {
        let region: Region;

        const [[maxLng, maxLat], [minLng, minLat]] =
          feature.properties.visibleBounds;
        region = {
          latitude: (maxLat + minLat) / 2,
          longitude: (maxLng + minLng) / 2,
          latitudeDelta: maxLat - minLat,
          longitudeDelta: maxLng - minLng,
        };

        __DEV__ &&
          console.log(
            "#rIMmxg Map move completed",
            region,
            feature.properties?.visibleBounds,
          );
        const boundingBox = regionToBoundingBox(region);
        dispatch(mapActions.setBoundingBox(boundingBox));
        const visiblePlusCodes = allPlusCodesForRegion(region);
        dispatch(setVisiblePlusCodes(visiblePlusCodes));
        const length = visiblePlusCodes.length;
        log.debug("#mzWdGm regionChange plusCode length", length);
      },
    [dispatch],
  );

  const plusCodesGeoJSON = useMemo(() => {
    const features = plusCodesWithState.map((plusCodeWithState) => {
      const rectangle = plusCodeToRectangle(plusCodeWithState.plusCode);

      // GeoJSON expects coordinates as [lng, lat] arrays
      const coordinates = [
        [
          rectangle[0].longitude,
          rectangle[0].latitude, // bottom-left
        ],
        [
          rectangle[1].longitude,
          rectangle[1].latitude, // top-left
        ],
        [
          rectangle[2].longitude,
          rectangle[2].latitude, // top-right
        ],
        [
          rectangle[3].longitude,
          rectangle[3].latitude, // bottom-right
        ],
        [
          rectangle[0].longitude,
          rectangle[0].latitude, // close the polygon
        ],
      ];

      return {
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [coordinates],
        },
        properties: {
          plusCode: plusCodeWithState.plusCode,
          eventCount:
            plusCodeWithState.eventCountForThisPlusCodeExactly +
            plusCodeWithState.eventCountWithinThisPlusCode,
        },
      };
    });

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [plusCodesWithState]);

  return (
    <MapView
      ref={map}
      style={{ flex: 1 }}
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
      onDidFinishLoadingMap={async () => {
        log.debug("#K7EGGk Maplibre map finished loading");
        const boundaries = await map.current?.getVisibleBounds();
        if (!boundaries) {
          log.error("#gFwP2E boundaries is undefined");
          return;
        }

        const [[maxLng, maxLat], [minLng, minLat]] = boundaries;
        const region = {
          latitude: (maxLat + minLat) / 2,
          longitude: (maxLng + minLng) / 2,
          latitudeDelta: maxLat - minLat,
          longitudeDelta: maxLng - minLng,
        };

        handleMapRegionChange(region);
      }}
      onRegionDidChange={handleMapRegionChange}
    >
      {enablePlusCodes && plusCodesWithState.length > 0 && (
        <ShapeSource
          id="plus-codes-source"
          shape={plusCodesGeoJSON}
          onPress={(event) => {
            const feature = event.features[0];
            const plusCode = feature?.properties?.plusCode;
            if (plusCode) {
              dispatch(mapActions.setSelectedPlusCode(plusCode));
            }
          }}
        >
          <FillLayer
            id="plus-codes-fill"
            style={{
              fillColor: [
                "rgba",
                ["min", 255, ["*", ["get", "eventCount"], 60]],
                0,
                0,
                0.6,
              ],
              fillOutlineColor: "rgba(0, 0, 0, 0.5)",
            }}
          />
        </ShapeSource>
      )}
    </MapView>
  );
}
