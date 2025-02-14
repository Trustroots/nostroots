import TEMPORARYSetUsername from "@/components/TEMPORARYSetUsername";
import { useNotifications } from "@/hooks/useNotifications";
import {
  getHasPrivateKeyInSecureStorage,
  getPrivateKeyHex,
  getPrivateKeyMnemonic,
} from "@/nostr/keystore.nostr";
import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setPrivateKeyMnemonicPromiseAction } from "@/redux/sagas/keystore.saga";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
import {
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";
import { generateSeedWords, getBech32PrivateKey } from "nip06";
import { useEffect, useState } from "react";
import {
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

const DevSwitch = () => {
  const dispatch = useAppDispatch();
  const areTestFeaturesEnabled = useAppSelector(
    settingsSelectors.selectAreTestFeaturesEnabled,
  );

  const toggleTestFeatures = (
    value: boolean | ((prevState: boolean) => boolean),
  ) => {
    dispatch(settingsActions.toggleTestFeatures);
  };

  return (
    <View>
      <Switch
        value={areTestFeaturesEnabled}
        onValueChange={toggleTestFeatures}
      />
      <Text>dev mode</Text>
      {areTestFeaturesEnabled && <Text>DEV MODE ON</Text>}
    </View>
  );
};

export default function TabThreeScreen() {
  const [nsec, setNsec] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const hasPrivateKey = useAppSelector(
    keystoreSelectors.selectHasPrivateKeyInSecureStorage,
  );
  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub);
  // const pubHex = useAppSelector(keystoreSelectors.selectPublicKeyHex);
  const dispatch = useAppDispatch();

  const { expoPushToken } = useNotifications();

  useEffect(() => {
    (async function asyncInner() {
      const hasKey = await getHasPrivateKeyInSecureStorage();
      if (!hasPrivateKey && !hasKey) {
        const { mnemonic } = generateSeedWords();
        dispatch(setPrivateKeyMnemonicPromiseAction.request(mnemonic));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.settings}>
      <ScrollView>
        <Text style={styles.header}>Keys</Text>
        <Text style={styles.q}>npub</Text>
        <TextInput style={styles.input} value={npub} />
        {/**
        <Text style={styles.settings}>pub key hex</Text>
        <TextInput style={styles.input} value={pubHex} />
        */}
        <Text style={styles.q}>nsec</Text>
        <TextInput style={styles.input} value={nsec} />
        <Button
          title="Show nsec"
          onPress={async () => {
            try {
              const keyHex = await getPrivateKeyHex();
              const mnemonic = await getPrivateKeyMnemonic();
              const { bech32PrivateKey } = getBech32PrivateKey({
                privateKey: keyHex,
              });
              setNsec(bech32PrivateKey);
              setMnemonic(mnemonic);
              setTimeout(() => {
                setNsec("");
                setMnemonic("");
              }, 15e3);
            } catch (error) {
              console.error("#bVVgTl Error getting nsec and mnemonic", error);
            }
          }}
        />
        {/*
        <Text style={styles.settings}>seed</Text>
        <TextInput
          style={styles.input}
          value={mnemonic}
          onChangeText={setMnemonic}
        />
        <Button
          title="Save mnemonic"
          onPress={async () => {
            dispatch(
              setPrivateKeyMnemonicPromiseAction.request(mnemonic.trim()),
            )
              .then(
                Toast.show("Saved", {
                  position: Toast.positions.TOP,
                  duration: 10e3,
                }),
              )
              .catch((error: Error) => {
                Toast.show(`#EgV9ut Error ${error}`, {
                  position: Toast.positions.TOP,
                  duration: 10e3,
                });
              });
          }}
        />
        */}
        <Text style={styles.q}>relays</Text>
        <TextInput style={styles.input} value="['relay.trustroots.org']" />
        <Text style={styles.q}>expo push token</Text>
        <TextInput style={styles.input} value={expoPushToken} />

        <TEMPORARYSetUsername />

        <Text style={styles.header}>Help</Text>
        <Text style={styles.q}>How does this work?</Text>

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
            __DEV__ && console.log("#bLtiOc pressed");
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
      <DevSwitch />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  settings: {
    backgroundColor: "#ffffff",
  },
  q: {
    fontSize: 15,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 10,
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
    marginLeft: 7,
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
