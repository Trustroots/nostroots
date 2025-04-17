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

import BuildData from "@/components/BuildData";
import OnboardModal from "@/components/OnboardModal";
import { useNotifications } from "@/hooks/useNotifications";
import {
  derivePublicKeyHexFromMnemonic,
  getPrivateKeyHex,
  getPrivateKeyMnemonic,
} from "@/nostr/keystore.nostr";
import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import { notificationSubscribeToFilterPromiseAction } from "@/redux/actions/notifications.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setPrivateKeyMnemonicPromiseAction } from "@/redux/sagas/keystore.saga";
import {
  keystoreSelectors,
  setPublicKeyHex,
} from "@/redux/slices/keystore.slice";
import { notificationsSlice } from "@/redux/slices/notifications.slice";
import {
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";
import Toast from "react-native-root-toast";

const DevSwitch = () => {
  const dispatch = useAppDispatch();
  const areTestFeaturesEnabled = useAppSelector(
    settingsSelectors.selectAreTestFeaturesEnabled,
  );

  const toggleTestFeatures = (
    value: boolean | ((prevState: boolean) => boolean),
  ) => {
    dispatch(settingsActions.toggleTestFeatures());
  };

  return (
    <View>
      <Switch
        value={areTestFeaturesEnabled}
        onValueChange={toggleTestFeatures}
      />
      {areTestFeaturesEnabled && <Text>DEV MODE ON</Text>}
    </View>
  );
};

export default function TabThreeScreen() {
  const { expoPushToken } = useNotifications();

  const username = useAppSelector(settingsSelectors.selectUsername);

  const areTestFeaturesEnabled = useAppSelector(
    settingsSelectors.selectAreTestFeaturesEnabled,
  );

  const [nsec, setNsec] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [mnemonicInput, setMnemonicInput] = useState("");
  const [showUpdateButton, setShowUpdateButton] = useState(false);
  const hasPrivateKeyFromRedux = useAppSelector(
    keystoreSelectors.selectHasPrivateKeyInSecureStorage,
  );

  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub);
  const publicKeyHex = useAppSelector(keystoreSelectors.selectPublicKeyHex);

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
      setMnemonicInput(mnemonic);
      setShowUpdateButton(false);
    } catch (error) {
      console.error("#bVVgTl Error getting nsec and mnemonic", error);
    }
  };

  const handleMnemonicChange = (text: string) => {
    setMnemonicInput(text);
    // Only show update button if the input is different from the current mnemonic
    setShowUpdateButton(text !== mnemonic && text.trim() !== "");
  };

  const handleMnemonicSubmit = () => {
    if (mnemonicInput.trim() !== "") {
      dispatch(setPrivateKeyMnemonicPromiseAction.request(mnemonicInput));
      const pubKeyHex = derivePublicKeyHexFromMnemonic(mnemonicInput);
      dispatch(setPublicKeyHex(pubKeyHex));
      setMnemonicInput("");
      setShowUpdateButton(false);
      Toast.show("Mnemonic updated successfully", {
        duration: Toast.durations.SHORT,
      });
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
          <View>
            <Text style={styles.q}>trustroots.org</Text>
            <View style={styles.input}>
              <Button
                title="Link Your Trustroots.org Profile"
                onPress={() => setModalVisible(true)}
              />
            </View>
          </View>
        ) : null}

        {username.length > 0 || areTestFeaturesEnabled ? (
          <View>
            <View>
              <Text style={styles.q}>trustroots.org</Text>
              <Text style={styles.q}>username: {username}</Text>
            </View>

            <View>
              <Text style={styles.q}>npub</Text>
              <TextInput style={styles.input} value={npub} />
              <Text style={styles.q}>public key hex</Text>
              <TextInput style={styles.input} value={publicKeyHex} />
              <Text style={styles.q}>nsec</Text>
              <TextInput style={styles.input} value={nsec} />
              <Text style={styles.q}>nsec mnemonic</Text>
              <TextInput
                style={styles.input}
                value={mnemonicInput}
                onChangeText={handleMnemonicChange}
              />
              {showUpdateButton && (
                <Button
                  style={styles.updateButton}
                  title="Save New Mnemonic"
                  onPress={handleMnemonicSubmit}
                />
              )}
              <Button title="Show nsec" onPress={showNsec} />
            </View>
          </View>
        ) : null}

        {areTestFeaturesEnabled && (
          <View>
            <BuildData />
            <Text style={styles.q}>relays</Text>
            <TextInput style={styles.input} value="['relay.trustroots.org']" />
            <Text style={styles.q}>expo push token</Text>
            <TextInput style={styles.input} value={expoPushToken} />

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
          </View>
        )}

        <Button
          title="Set filter notification"
          onPress={async () => {
            try {
              dispatch(
                notificationsSlice.actions.setExpoPushToken(
                  "ExponentPushToken[tnvHKbIICOgGP7SxcA2jcB]",
                ),
              );
              const result = await dispatch(
                notificationSubscribeToFilterPromiseAction.request({
                  filter: { kinds: [30397] },
                }),
              );
              Toast.show(`#PnvMz0 Success: ${JSON.stringify(result)}`);
            } catch (error) {
              Toast.show(`#Y0WER5 Error: ${error}`);
            }
          }}
        />

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

        <View>
          <Text style={styles.q}>dev switch</Text>
          <View style={styles.section}>
            <DevSwitch />
          </View>
        </View>
      </ScrollView>
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
  section: {
    paddingBottom: 10,
    paddingTop: 10,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
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
  updateButton: {
    marginTop: 10,
    backgroundColor: "blue",
  },
});
