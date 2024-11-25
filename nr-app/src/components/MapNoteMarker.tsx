import { EventWithMetadata } from "@/redux/slices/events.slice";
import {
  getEventLinkUrl,
  getMapLayer,
  isValidPlusCode,
  plusCodeToCoordinates,
  plusCodeToRectangle,
} from "@/utils/map.utils";
import { getFirstLabelValueFromEvent } from "@common/utils";
import React, { memo } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Callout, Marker, Polygon } from "react-native-maps";

export function MapNoteMarkerInner({
  event,
  layerKey,
}: {
  event: EventWithMetadata;
  layerKey?: string;
}) {
  console.log("#iNicG9 NoteMarker / render()", Date.now());
  const plusCode = getFirstLabelValueFromEvent(
    event.event,
    "open-location-code",
  );

  if (typeof plusCode === "undefined" || !isValidPlusCode(plusCode)) {
    console.log(
      "#9k8qKM skipping event with missing / invalid plusCode",
      JSON.stringify({ plusCode, event }),
    );
    return null;
  }

  const layerConfig = getMapLayer(layerKey);
  const coordinates = plusCodeToCoordinates(plusCode);
  const rectangleCoordinates = plusCodeToRectangle(plusCode);

  const url = getEventLinkUrl(event.event, layerConfig);

  const pinColor = layerConfig?.markerColor || "red";
  const rectangleColor = layerConfig?.rectangleColor || "rgba(255,0,0,0.5)";

  return (
    <View>
      <Marker coordinate={coordinates} pinColor={pinColor}>
        <Callout
          onPress={() => {
            if (typeof url !== "undefined") {
              Linking.openURL(url);
            }
          }}
        >
          <View style={styles.marker}>
            <Text>
              {`${new Date(event.event.created_at * 1000).toLocaleString()} ${event.event.content} `}
              <Text style={{ color: "blue" }}>{url}</Text>
              <Text>{plusCode || null}</Text>
            </Text>
          </View>
        </Callout>
      </Marker>
      <Polygon
        coordinates={rectangleCoordinates}
        fillColor={rectangleColor}
        strokeColor="rgba(0, 0, 0, 0.5)" // Semi-transparent black
        strokeWidth={2}
      />
    </View>
  );
}

export const MapNoteMarker = memo(MapNoteMarkerInner);

const styles = StyleSheet.create({
  marker: {
    width: 200,
  },
});
