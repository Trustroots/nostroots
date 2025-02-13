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
  Button,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getNip5PubKey } from "../../../nr-common/utils.ts";

import {
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";
import { generateSeedWords, getBech32PrivateKey } from "nip06";
import { useEffect, useState } from "react";
import {
  Linking,
  SafeAreaView,
  ScrollView,
  Switch,
  TextInput,
} from "react-native";
import Toast from "react-native-root-toast";

import * as Clipboard from "expo-clipboard";

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
  const username = useAppSelector(settingsSelectors.selectUsername);

  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [nip5VerificationLoading, setNip5VerificationLoading] =
    useState<boolean>(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [nsec, setNsec] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const hasPrivateKeyFromRedux = useAppSelector(
    keystoreSelectors.selectHasPrivateKeyInSecureStorage,
  );
  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub);
  const pubHex = useAppSelector(keystoreSelectors.selectPublicKeyHex);
  const dispatch = useAppDispatch();

  useEffect(() => {
    (async function asyncInner() {
      const hasKeyFromStorage = await getHasPrivateKeyInSecureStorage();
      if (!hasPrivateKeyFromRedux && !hasKeyFromStorage) {
        const { mnemonic } = generateSeedWords();
        dispatch(setPrivateKeyMnemonicPromiseAction.request(mnemonic));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const OpenTrustRootsButton = () => {
    const url = "https://www.trustroots.org/";
    const handlePress = async () => {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // fail silently, some kind of compatibility error happened?
        console.error(`Don't know how to open this URL: ${url}`);
      }
    };

    return <Button title="Open TrustRoots Website" onPress={handlePress} />;
  };

  const handleUsernameSubmit = async () => {

    // sanity check if the username exists
    if (username !== "") {
      return;
    }

    if (text.trim().length < 3 || !/^[a-zA-Z0-9]+$/.test(text.trim())) {
      setError("Input must be at least 3 alphanumeric characters.");
      return;
    }
    // freeze the text box
    setNip5VerificationLoading(true);
    const nip5Result = await getNip5PubKey(text);

    setNip5VerificationLoading(false);
    if (nip5Result === undefined) {
      setError("Invalid username for this key.");
      return;
    }
    setError(null);

    setText("");
    dispatch(settingsActions.setUsername(text));
  };

  const handleTextChange = (newText: string) => {
    if (nip5VerificationLoading === false) {
      setText(newText);
    }
  };

  const handleCopy = async (npub) => {
    await Clipboard.setStringAsync(npub || "");
    Toast.show("Copied public key to Clipboard!", {
      duration: Toast.durations.LONG,
      position: Toast.positions.TOP,
    });
  };

  const modal = (
    <Modal
      animationType="slide"
      transparent={false}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.instructions}>
          <Text style={styles.modalText}>
            How to link your app key to trustroots.org
          </Text>
          <Text style={styles.modalText}>1) Log into trustroots.org</Text>
          <Text style={styles.modalText}>
            2) Copy and save your public key on trustroots
          </Text>
          <Text style={styles.modalText}>
            3) Save your trustroots user name in the app.
          </Text>

          <View style={styles.usernameContainer}>
            <Text style={styles.usernameLabel}>Enter text:</Text>
            <TextInput
              style={[
                styles.usernameInput,
                error ? styles.usernameInputError : null,
              ]}
              value={text}
              onChangeText={handleTextChange}
              placeholder="Verify your trustroots username"
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Text style={styles.output}>You typed: {text}</Text>

            <TouchableOpacity
              style={styles.usernameSubmitBtn}
              onPress={handleUsernameSubmit}
            >
              <Text style={styles.usernameSubmit}>Submit</Text>
            </TouchableOpacity>
          </View>

          <OpenTrustRootsButton />
          <Button
            title="Copy Public Key to Clipboard"
            onPress={() => handleCopy(npub)}
          />
        </View>

        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setModalVisible(false)}
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.settings}>
      <ScrollView>
        <Text style={styles.header}>username: {username}</Text>
        <Text style={styles.header}>Keys</Text>
        <View>
          <Button
            title="Link your TrustRoots Key"
            onPress={() => setModalVisible(true)}
          />
          {modal}
        </View>
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
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  modalText: {
    fontSize: 20,
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: "#2196F3",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
  },

  // username

  usernameContainer: {
    padding: 0,
  },
  usernameLabel: {
    fontSize: 16,
    marginBottom: 5,
  },
  usernameInput: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  usernameSubmitBtn: {
    backgroundColor: "#2196F3",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: "center",
  },
  usernameSubmit: {
    color: "white",
    fontSize: 16,
  },

  usernameInputError: {
    borderColor: "red",
  },
  output: {
    fontSize: 16,
    color: "blue",
  },
});
