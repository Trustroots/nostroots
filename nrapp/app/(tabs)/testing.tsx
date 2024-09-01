import Ionicons from "@expo/vector-icons/Ionicons";
import {
  StyleSheet,
  Image,
  Platform,
  SafeAreaView,
  View,
  Text,
} from "react-native";

import { Collapsible } from "@/components/Collapsible";
import { ExternalLink } from "@/components/ExternalLink";
import ParallaxScrollView from "@/components/ParallaxScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { SplitPane } from "expo-split-pane";
//import SplitPane from "expo-split-pane";

export default function TabThreeScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <SplitPane
        style={{ flex: 0.3 }}
        orientation="vertical"
        pane1={
          <View
            style={{ flex: 1, flexGrow: 1, backgroundColor: "deepskyblue" }}
          >
            <Text>top1</Text>
          </View>
        }
        pane2={
          <View style={{ flex: 1, flexGrow: 1, backgroundColor: "dodgerblue" }}>
            <Text>top2</Text>
          </View>
        }
      />
      <SplitPane
        style={{ flex: 1 }}
        orientation="horizontal"
        pane1={
          <View
            style={{ flex: 1, flexGrow: 1, backgroundColor: "lightyellow" }}
          >
            <Text>center1</Text>
          </View>
        }
        pane2={
          <View style={{ flex: 1, flexGrow: 1, backgroundColor: "khaki" }}>
            <Text>center2</Text>
          </View>
        }
      />
      <SplitPane
        style={{ flex: 0.3 }}
        orientation="vertical"
        pane1={
          <View style={{ flex: 1, flexGrow: 1, backgroundColor: "lightgreen" }}>
            <Text>bottom1</Text>
          </View>
        }
        pane2={
          <View style={{ flex: 1, flexGrow: 1, backgroundColor: "limegreen" }}>
            <Text>bottom2</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: "#808080",
    bottom: -90,
    left: -35,
    position: "absolute",
  },
  titleContainer: {
    flexDirection: "row",
    gap: 8,
  },
});
