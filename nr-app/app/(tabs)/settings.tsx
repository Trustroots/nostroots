import {
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { generateSeedWords, accountFromSeedWords } from "nip06";

export default function TabThreeScreen() {
  const { mnemonic } = generateSeedWords();
  const account = accountFromSeedWords({ mnemonic });
  console.log("#0GAjcE Generated seed and private key", {
    mnemonic,
    account,
  });

  return (
    <SafeAreaView style={styles.settings}>
      <ScrollView>
        <Text style={styles.header}>Keys</Text>
        <Text style={styles.settings}>npub</Text>
        <TextInput style={styles.input} value={account.publicKey.bech32} />
        <Text style={styles.settings}>nsec</Text>
        <TextInput style={styles.input} value={account.privateKey.bech32} />
        <Text style={styles.settings}>seed</Text>
        <TextInput style={styles.input} value={mnemonic} />
        <Text style={styles.header}>Relays</Text>
        <TextInput style={styles.input} value="['relay1', 'relay2']" />
        <Text style={styles.header}>Help</Text>
        <Text style={styles.h3}>How does this work?</Text>

        <Text>
          Scroll around on the map. Long press (or right click) to add a note to
          the map.
        </Text>

        <Text style={styles.h3}>Where can I get help?</Text>

        <Text>
          If you encounter issues with this app, or want to share feedback, you
          can reach the team behind this on telegram or reddit, satellite.earth
          (a reddit-style nostr application) or simply leave a note here in the
          Antarctica area.
        </Text>

        <Text style={styles.h3}>How does this improve Trustroots?</Text>

        <Text>
          Thanks for asking. Soon(tm): We hope we can quickly build something
          like a geochat app which is better and more used than what the old
          meet functionality had to offer, and which adds some interactivity to
          circles. Mid-term: We want this app and Trustroots users to be able to
          interact with other applications, such as e.g. hitchmap.com build new
          applications e.g. for ridesharing or finding out where the cool events
          and parties are. Long-term: We strive to make the centralized
          Trustroots server and database and thus the official organization
          irrelevant.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  settings: { backgroundColor: "#ffffff" },
  h3: {
    fontSize: 15,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 10,
  },
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
