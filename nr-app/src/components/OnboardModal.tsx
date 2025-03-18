import {
  derivePublicKeyHexFromMnemonic,
  getHasPrivateKeyInSecureStorage,
  getPrivateKeyMnemonic,
} from "@/nostr/keystore.nostr";
// import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
//

import { generateSeedWords } from "nip06";

import * as Clipboard from "expo-clipboard";
import {
  Button,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { setPrivateKeyMnemonicPromiseAction } from "@/redux/sagas/keystore.saga";

import Toast from "react-native-root-toast";

import {
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { useEffect, useState } from "react";

import {
  keystoreSelectors,
  setPublicKeyHex,
} from "@/redux/slices/keystore.slice";

import { getNip5PubKey } from "@trustroots/nr-common";

interface OnboardModalProps {
  setModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function OnboardModal({ setModalVisible }: OnboardModalProps) {
  const dispatch = useAppDispatch();

  const username = useAppSelector(settingsSelectors.selectUsername);

  // (() => {
  //   const { mnemonic } = generateSeedWords();
  //   console.log("MMNMNNM", mnemonic);
  // })();

  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub);
  const pubHex = useAppSelector(keystoreSelectors.selectPublicKeyHex);
  console.log("pub keys:", npub, pubHex);

  const [step, setStep] = useState<string>("isUserScreen");
  const [mnemonicText, setMnemonicText] = useState<string>("");
  const [usernameText, setUsernameText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [nip5VerificationLoading, setNip5VerificationLoading] =
    useState<boolean>(false);

  const hasPrivateKeyFromRedux = useAppSelector(
    keystoreSelectors.selectHasPrivateKeyInSecureStorage,
  );

  // init the component:
  // get the key from secure storage and put it in redux
  useEffect(() => {
    (async function asyncInner() {
      const hasKeyFromStorage = await getHasPrivateKeyInSecureStorage();

      // if we don't have it in redux
      if (hasKeyFromStorage && !hasPrivateKeyFromRedux) {
        const mnemonic = await getPrivateKeyMnemonic();

        dispatch(setPrivateKeyMnemonicPromiseAction.request(mnemonic));
        const pubKeyHex = derivePublicKeyHexFromMnemonic(mnemonic);
        dispatch(setPublicKeyHex(pubKeyHex));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const OpenTrustRootsButton = ({
    url,
    title,
  }: {
    url: string;
    title: string;
  }) => {
    const handlePress = async () => {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // fail silently, some kind of compatibility error happened?
        console.error(`Don't know how to open this URL: ${url}`);
      }
    };

    return <Button title={title} onPress={handlePress} />;
  };

  const handleMnemonicSubmit = () => {
    dispatch(setPrivateKeyMnemonicPromiseAction.request(mnemonicText));
    setStep("usernameScreen");
  };

  const handleMnemonicChange = (text: string) => {
    // TODO: validation for mnemonic key
    setMnemonicText(text);
  };

  const handleUsernameSubmit = async () => {
    // sanity check if the username exists
    if (username !== "") {
      return;
    }

    // TODO: basic text input validation??
    if (
      usernameText.trim().length < 3 ||
      !/^[a-zA-Z0-9]+$/.test(usernameText.trim())
    ) {
      setError("Input must be at least 3 alphanumeric characters.");
      return;
    }
    // freeze the text box
    setNip5VerificationLoading(true);
    const nip5Result = await getNip5PubKey(usernameText);

    setNip5VerificationLoading(false);
    if (nip5Result === npub) {
      setError(null);

      setUsernameText("");
      dispatch(settingsActions.setUsername(usernameText));
      setStep("finishScreen");
      return;
    }

    setError(
      "Invalid username for this key. Check your username or your public key.",
    );
    return;
  };

  const handleTextChange = (text: string) => {
    if (nip5VerificationLoading === false) {
      setUsernameText(text);
    }
  };

  const handleCopy = async (npub: string | undefined) => {
    await Clipboard.setStringAsync(npub || "");
    Toast.show("Copied public key to Clipboard!", {
      duration: Toast.durations.LONG,
      position: Toast.positions.TOP,
    });
  };

  const handleGenKey = async () => {
    const hasKeyFromStorage = await getHasPrivateKeyInSecureStorage();
    if (!hasPrivateKeyFromRedux && !hasKeyFromStorage) {
      const { mnemonic } = generateSeedWords();
      await dispatch(setPrivateKeyMnemonicPromiseAction.request(mnemonic));
      setStep("setPubKeyScreen");
    }
  };

  const nextStepIsUser = async () => {
    // check to see if a key has been set
    const hasKeyFromStorage = await getHasPrivateKeyInSecureStorage();
    if (!hasPrivateKeyFromRedux && !hasKeyFromStorage) {
      // go to set key
      setStep("genKeyPairScreen");
    } else
      // skip key set to next step
      setStep("setPubKeyScreen");
  };

  const genKeyPairScreen = (
    <View style={styles.instructions}>
      <Text style={styles.modalText}>
        Let's set a trustroots.org cryptographic key pair.
      </Text>

      <View style={styles.usernameContainer}>
        <TouchableOpacity
          style={styles.usernameSubmitBtn}
          onPress={handleGenKey}
        >
          <Text style={styles.usernameSubmit}>
            Generate me a new cryptographic key pair.
          </Text>
        </TouchableOpacity>
      </View>

      <Button
        title="I'd like to set my own cryptographic key."
        onPress={() => setStep("setKeyMnemonicScreen")}
      />
    </View>
  );

  const setKeyMnemonicScreen = (
    <View style={styles.instructions}>
      <Text style={styles.modalText}>Let's set a trustroots.org key.</Text>

      <View style={styles.usernameContainer}>
        <Text style={styles.usernameLabel}>Paste mnemonic here:</Text>
        <TextInput
          style={[
            styles.usernameInput,
            error ? styles.usernameInputError : null,
          ]}
          value={mnemonicText}
          onChangeText={handleMnemonicChange}
          placeholder="mnemonic text"
        />

        {error && <Text style={styles.usernameInputError}>{error}</Text>}

        <TouchableOpacity
          style={styles.usernameSubmitBtn}
          onPress={handleMnemonicSubmit}
        >
          <Text style={styles.usernameSubmit}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const isUserScreen = (
    <View style={styles.instructions}>
      <Text style={styles.modalText}>
        Do you have a trustroots.org account?
      </Text>
      <OpenTrustRootsButton
        url={"https://www.trustroots.org/signup"}
        title={"No, create a trustroots.org account."}
      />
      <Button
        title="Yes, I already have an account."
        onPress={nextStepIsUser}
      />
    </View>
  );

  const usernameScreen = (
    <View style={styles.instructions}>
      <Text style={styles.modalText}>Set your trustroots.org username.</Text>

      <View style={styles.usernameContainer}>
        <Text style={styles.usernameLabel}>trustroots.org username:</Text>
        <TextInput
          style={[
            styles.usernameInput,
            error ? styles.usernameInputError : null,
          ]}
          value={usernameText}
          onChangeText={handleTextChange}
          placeholder="Verify your trustroots username"
        />
        {error && <Text style={styles.usernameInputError}>{error}</Text>}

        <TouchableOpacity
          style={styles.usernameSubmitBtn}
          onPress={handleUsernameSubmit}
        >
          <Text style={styles.usernameSubmit}>Submit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const setPubKeyScreen = (
    <View style={styles.instructions}>
      <Text style={styles.modalText}>
        Copy your public key and set your public key on your trustroots.org
        profile.
      </Text>

      <Text style={styles.modalText}>Public Key: {npub}</Text>

      <Button
        title="Copy Public Key to Clipboard"
        onPress={() => handleCopy(npub)}
      />

      <OpenTrustRootsButton
        url={`https://notes.trustroots.org/#user=${username}`}
        title={"Set Public Key (trustroots.org)"}
      />

      <TouchableOpacity
        style={styles.usernameSubmitBtn}
        onPress={() => setStep("usernameScreen")}
      >
        <Text style={styles.usernameSubmit}>I set my Key</Text>
      </TouchableOpacity>
    </View>
  );

  const finishScreen = (
    <View style={styles.instructions}>
      <Text style={styles.modalText}>Thanks {username}, you're all set!</Text>
    </View>
  );

  let stepScreen;
  switch (step) {
    case "isUserScreen":
      stepScreen = isUserScreen;
      break;
    case "usernameScreen":
      // stepScreen = step1;
      stepScreen = usernameScreen;
      break;
    case "genKeyPairScreen":
      stepScreen = genKeyPairScreen;
      break;

    case "setKeyMnemonicScreen":
      stepScreen = setKeyMnemonicScreen;
      break;
    case "setPubKeyScreen":
      stepScreen = setPubKeyScreen;
      break;

    case "finishScreen":
      stepScreen = finishScreen;
      break;
  }

  return (
    <View style={styles.modalContainer}>
      {stepScreen}

      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => setModalVisible(false)}
      >
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  instructions: {
    padding: 50,
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
