import { View } from "react-native";

import Map from "@/components/Map";

export default function HomeScreen() {
  return (
    <View testID="map-screen" className="flex-1">
      <Map />
    </View>
  );
}
