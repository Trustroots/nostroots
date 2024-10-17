import { SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";

export default function TabThreeScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View>
        <Text style={styles.header}>Keys</Text>
        <Text>npub</Text>
        <TextInput style={styles.input} value="npub" />
        <Text>nsec</Text>
        <TextInput style={styles.input} value="nsec" />
        <Text>seed</Text>
        <TextInput style={styles.input} value="seed" />
        <Text style={styles.header}>Relays</Text>
        <TextInput style={styles.input} value="['relay1', 'relay2']" />
        <Text style={styles.header}>Help</Text>
        <Text style={{ color: "#880088" }}>
          Copy and adapt some text from notes.trustroots.org
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pane1: { flex: 1, flexGrow: 1, backgroundColor: "deepskyblue" },
  header: {
    fontSize: 24, // Font size for the header text
    fontWeight: "bold", // Bold text
    padding: 4, // Padding around the text
    backgroundColor: "#f8f8f8", // Background color for the header
    borderBottomWidth: 1, // Optional: add a bottom border
    borderBottomColor: "#ddd", // Optional: color of the bottom border
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
});
