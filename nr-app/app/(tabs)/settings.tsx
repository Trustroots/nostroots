import { getPrivateKeyHex } from "@/nostr/keystore.nostr";
import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setPrivateKeyPromiseAction } from "@/redux/sagas/keystore.saga";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
import { generateSeedWords, getBech32PrivateKey } from "nip06";
import { useEffect, useState } from "react";
import {
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

export default function TabThreeScreen() {
  const [nsec, setNsec] = useState("");
  const hasPrivateKey = useAppSelector(
    keystoreSelectors.selectHasPrivateKeyInSecureStorage,
  );
  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub);
  const pubHex = useAppSelector(keystoreSelectors.selectPublicKeyHex);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!hasPrivateKey) {
      const { mnemonic } = generateSeedWords();
      dispatch(setPrivateKeyPromiseAction.request(mnemonic));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.settings}>
      <ScrollView>
        <Text style={styles.header}>Keys</Text>
        <Text style={styles.settings}>npub</Text>
        <TextInput style={styles.input} value={npub} />
        <Text style={styles.settings}>pub key hex</Text>
        <TextInput style={styles.input} value={pubHex} />
        <Text style={styles.settings}>nsec</Text>
        {/* <TextInput style={styles.input} value={account.privateKey.bech32} /> */}
        <Text style={styles.settings}>seed</Text>
        {/* <TextInput style={styles.input} value={mnemonic} /> */}
        <Text style={styles.header}>Relays</Text>
        <TextInput style={styles.input} value="['relay1', 'relay2']" />
        <Text style={styles.header}>Help</Text>
        <Text style={styles.q}>How does this work?</Text>

        <Button
          title="Get nsec"
          onPress={async () => {
            const keyHex = await getPrivateKeyHex();
            const { bech32PrivateKey } = getBech32PrivateKey({
              privateKey: keyHex,
            });
            setNsec(bech32PrivateKey);
            setTimeout(() => {
              setNsec("");
            }, 3e3);
          }}
        />
        <TextInput style={styles.input} value={nsec} />

        <Text style={styles.a}>
          Scroll around on the map. Long press (or right click) to add a note to
          the map.
        </Text>

        <Text style={styles.q}>Where can I get help?</Text>

        <Text style={styles.a}>
          If you encounter issues with this app, or want to share feedback, you
          can reach the team behind this on telegram or reddit, satellite.earth
          (a reddit-style nostr application) or simply leave a note here in the
          Antarctica area.
        </Text>

        <Text style={styles.q}>How does this improve Trustroots?</Text>

        <Text style={styles.a}>
          Thanks for asking. Soon(tm): We hope we can quickly build something
          like a geochat app which is better and more used than what the old
          meet functionality had to offer, and which adds some interactivity to
          circles.
        </Text>
        <Text style={styles.a}>
          Mid-term: We want this app and Trustroots users to be able to interact
          with other applications, such as e.g. hitchmap.com build new
          applications e.g. for ridesharing or finding out where the cool events
          and parties are.
        </Text>
        <Text style={styles.a}>
          Long-term: We strive to make the centralized Trustroots server and
          database and thus the official organization irrelevant.
        </Text>

        <Button
          title="Set visible plus codes"
          onPress={() => {
            console.log("#bLtiOc pressed");
            dispatch(
              setVisiblePlusCodes([
                "8C000000+",
                "8F000000+",
                "8G000000+",
                "9C000000+",
                "9F000000+",
                "9G000000+",
              ]),
            );
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  settings: { backgroundColor: "#ffffff" },
  q: {
    fontSize: 15,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 10,
  },
  a: {
    marginBottom: 10,
    marginTop: 10,
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
