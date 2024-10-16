import { StyleSheet, Text, View } from "react-native";

export default function MapWeb() {
  return (
    <View style={styles.mapContainer}>
      <View style={styles.map}>
        <Text>The map doesn't (currently) work on web...</Text>
      </View>
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
    backgroundColor: "lightblue",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
