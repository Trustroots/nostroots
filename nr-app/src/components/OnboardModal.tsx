import {
  derivePublicKeyHexFromMnemonic,
  getHasPrivateKeyInSecureStorage,
  getPrivateKeyMnemonic,
} from "@/nostr/keystore.nostr";
import { publishEventTemplatePromiseAction } from "@/redux/actions/publish.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setPrivateKeyMnemonicPromiseAction } from "@/redux/sagas/keystore.saga";
import {
  keystoreSelectors,
  setPublicKeyHex,
} from "@/redux/slices/keystore.slice";
import {
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";
import {
  Kind10390EventTemplate,
  createKind10390EventTemplate,
  getNip5PubKey,
} from "@trustroots/nr-common";
import * as Clipboard from "expo-clipboard";
import { generateSeedWords } from "nip06";
import { nip19 } from "nostr-tools";
import { useEffect, useState } from "react";
import {
  Button,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-root-toast";

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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
    // Prevent multiple submissions
    if (isSubmitting) return;

    setIsSubmitting(true);

    // sanity check: the username has not been set yet
    if (username !== "") {
      setIsSubmitting(false);
      return;
    }

    // TODO: basic text input validation??
    if (
      usernameText.trim().length < 3 ||
      !/^[a-zA-Z0-9]+$/.test(usernameText.trim())
    ) {
      setError("Input must be at least 3 alphanumeric characters.");
      setIsSubmitting(false);
      return;
    }
    // freeze the text box
    setNip5VerificationLoading(true);
    const nip5Result = await getNip5PubKey(usernameText);

    if (nip5Result === undefined) {
      setError("There was an error requesting verification for this key.");
      setIsSubmitting(false);
      return;
    } else {
      const npubResponse = nip19.npubEncode(nip5Result);

      setNip5VerificationLoading(false);
      if (npubResponse === npub) {
        setError(null);

        try {
          console.log("about to publish event");
          const eventTemplate: Kind10390EventTemplate =
            createKind10390EventTemplate(usernameText);

          // publish the username pubkey event
          await dispatch(
            publishEventTemplatePromiseAction.request({ eventTemplate }),
          );
          console.log("publish event");

          setUsernameText("");
          dispatch(settingsActions.setUsername(usernameText));
          setStep("finishScreen");
        } catch (error) {
          console.log("error publishing", error);
          // const serializeableError = getSerializableError(error);
          Toast.show(
            // `Error sending profile event #grC53G ${serializeableError.toString()}`,
            `Error publishing username to relay`,
          );
        } finally {
          setIsSubmitting(false);
        }

        return;
      } else {
        console.log("nip5Result", npubResponse, npub);
        setError(
          "Invalid username for this key. Check your username or your public key.",
        );
        setIsSubmitting(false);
        return;
      }
    }
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
          autoCapitalize="none"
          autoCorrect={false}
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
          autoCapitalize="none"
          autoCorrect={false}
        />
        {error && <Text style={styles.usernameInputError}>{error}</Text>}

        <TouchableOpacity
          style={[
            styles.usernameSubmitBtn,
            isSubmitting ? styles.disabledButton : null,
          ]}
          onPress={handleUsernameSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.usernameSubmit}>
            {isSubmitting ? "Submitting..." : "Submit"}
          </Text>
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
        url={`https://www.trustroots.org/profile/edit/networks`}
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
  disabledButton: {
    backgroundColor: "#cccccc",
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
