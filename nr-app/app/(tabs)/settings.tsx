import { getBech32PrivateKey } from "nip06";
import { useState } from "react";
import {
  Button,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import OnboardModal from "@/components/OnboardModal";
import TEMPORARYSetUsername from "@/components/TEMPORARYSetUsername";
import { useNotifications } from "@/hooks/useNotifications";
import {
  derivePublicKeyHexFromMnemonic,
  getPrivateKeyHex,
  getPrivateKeyMnemonic,
} from "@/nostr/keystore.nostr";
import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  keystoreSelectors,
  setPublicKeyHex,
} from "@/redux/slices/keystore.slice";
import {
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";

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
  const { expoPushToken } = useNotifications();

  const username = useAppSelector(settingsSelectors.selectUsername);

  const [nsec, setNsec] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const hasPrivateKeyFromRedux = useAppSelector(
    keystoreSelectors.selectHasPrivateKeyInSecureStorage,
  );

  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub);

  const dispatch = useAppDispatch();

  const [modalVisible, setModalVisible] = useState(false);

  const showNsec = async () => {
    try {
      // const hasKeyFromStorage = await getHasPrivateKeyInSecureStorage();

      const keyHex = await getPrivateKeyHex();
      const mnemonic = await getPrivateKeyMnemonic();

      const pubKeyHex = derivePublicKeyHexFromMnemonic(mnemonic);
      dispatch(setPublicKeyHex(pubKeyHex));

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
  };

  return (
    <SafeAreaView style={styles.settings}>
      <ScrollView>
        <View>
          <Modal
            animationType="slide"
            transparent={false}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
          >
            <OnboardModal setModalVisible={setModalVisible} />
          </Modal>
        </View>
        {username === "" ? (
          <Button
            title="Link Your Trustroots.org Profile"
            onPress={() => setModalVisible(true)}
          />
        ) : (
          <Text style={styles.q}>username: {username}</Text>
        )}

        <Text style={styles.q}>npub</Text>
        <TextInput style={styles.input} value={npub} />
        <Text style={styles.q}>nsec</Text>
        <TextInput style={styles.input} value={nsec} />
        <Text style={styles.q}>nsec mnemonic</Text>
        <TextInput style={styles.input} value={mnemonic} />
        {hasPrivateKeyFromRedux && (
          <Button title="Show nsec" onPress={showNsec} />
        )}
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

  instructions: {
    padding: 50,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
