import { StyleSheet, View } from "react-native";

import { ThemedView } from "@/components/ThemedView";
import MapView from "react-native-maps";

export default function HomeScreen() {
  return (
    <ThemedView style={styles.titleContainer}>
      <View style={styles.mapContainer}>
        <MapView style={styles.map} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
});
