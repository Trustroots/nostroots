import { StyleSheet, View } from "react-native";

import MapView from "react-native-maps";

export default function HomeScreen() {
  return (
    <View style={styles.mapContainer}>
      <MapView style={styles.map} />
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
