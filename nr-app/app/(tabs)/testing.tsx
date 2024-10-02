import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { SplitPane } from "expo-split-pane";
//import SplitPane from "expo-split-pane";

export default function TabThreeScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <SplitPane
        style={{ flex: 0.3 }}
        orientation="vertical"
        pane1={
          <View style={styles.pane1}>
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
  pane1: { flex: 1, flexGrow: 1, backgroundColor: "deepskyblue" },
});
