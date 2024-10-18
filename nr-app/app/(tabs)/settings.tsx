import { ScrollView, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";

export default function TabThreeScreen() {
  return (
    <SafeAreaView style={styles.settings}>
      <ScrollView>
        <Text style={styles.header}>Keys</Text>
        <Text style={styles.settings}>npub</Text>
        <TextInput style={styles.input} value="npub" />
        <Text style={styles.settings}>nsec</Text>
        <TextInput style={styles.input} value="nsec" />
        <Text style={styles.settings}>seed</Text>
        <TextInput style={styles.input} value="seed" />
        <Text style={styles.header}>Relays</Text>
        <TextInput style={styles.input} value="['relay1', 'relay2']" />
        <Text style={styles.header}>Help</Text>
        <Text style={{ color: "#880088" }}>
          Copy and adapt some text from notes.trustroots.org
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  settings: { backgroundColor: "#ffffff" },
  header: {
    backgroundColor: "#f8f8f8",
    fontSize: 24,
    fontWeight: "bold",
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
  },
});
