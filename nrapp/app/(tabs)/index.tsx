import { StyleSheet, View } from "react-native";

import MapView, { Marker } from "react-native-maps";

export default function HomeScreen() {
  return (
    <View style={styles.mapContainer}>
      <MapView style={styles.map}>
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
