import {
  allPlusCodesForRegion,
  coordinatesToPlusCode,
} from "@/utils/map.utils";
import { StyleSheet, View } from "react-native";

import MapView, { Marker } from "react-native-maps";

export default function Map() {
  return (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.map}
        rotateEnabled={false}
        pitchEnabled={false}
        onRegionChangeComplete={(region, details) => {
          console.log("#rIMmxg Map move completed", region, details);
          const topRightCoordinates = {
            latitude: region.latitude + region.latitudeDelta,
            longitude: region.longitude + region.longitudeDelta,
          };
          const bottomLeftCoordinates = {
            latitude: region.latitude - region.latitudeDelta,
            longitude: region.longitude - region.longitudeDelta,
          };
          const topRightCode = coordinatesToPlusCode(topRightCoordinates);
          const bottomLeftCode = coordinatesToPlusCode(bottomLeftCoordinates);
          console.log(
            `#bu2PoU Bottom left is ${bottomLeftCode}, top right is ${topRightCode}`,
          );
          const parts = allPlusCodesForRegion(region);
          console.log("#fWrvAt Got parts", parts);
        }}
      >
        <Marker coordinate={{ latitude: 52, longitude: 13 }} title="A marker" />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
});
