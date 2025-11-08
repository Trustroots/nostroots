import { getHasPrivateKeyInSecureStorage } from "@/nostr/keystore.nostr";

import { publishEventTemplatePromiseAction } from "@/redux/actions/publish.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setPrivateKeyPromiseAction } from "@/redux/sagas/keystore.saga";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
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
import { Linking, StyleSheet, TextInput, View } from "react-native";
import Toast from "react-native-root-toast";
import { Button } from "./ui/button";
import { Text, TextClassContext } from "./ui/text";

interface OnboardModalProps {
  setModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  step?: string;
}

export default function OnboardModal({
  setModalVisible,
  step = "isUserScreen",
}: OnboardModalProps) {
  const dispatch = useAppDispatch();

  const username = useAppSelector(settingsSelectors.selectUsername);
  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub);

  const [currentStep, setCurrentStep] = useState<string>(step);
  const [mnemonicText, setMnemonicText] = useState<string>("");
  const [usernameText, setUsernameText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [nip5VerificationLoading, setNip5VerificationLoading] =
    useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const hasPrivateKeyFromRedux = useAppSelector(
    keystoreSelectors.selectHasPrivateKeyInSecureStorage,
  );

  // update currentStep when step prop changes
  useEffect(() => {
    setCurrentStep(step);
  }, [step]);

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
        if (__DEV__) console.error(`Don't know how to open this URL: ${url}`);
      }
    };

    return <Button onPress={handlePress} title={title} />;
  };

  const handleMnemonicSubmit = () => {
    dispatch(setPrivateKeyPromiseAction.request({ mnemonic: mnemonicText }));
    setCurrentStep("usernameScreen");
  };

  const handleMnemonicChange = (text: string) => {
    // TODO: validation for mnemonic key
    setMnemonicText(text);
  };

  const handleUsernameSubmit = async () => {
    // Prevent multiple submissions
    if (isSubmitting) return;

    setIsSubmitting(true);

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
          if (__DEV__) console.log("about to publish event");
          const eventTemplate: Kind10390EventTemplate =
            createKind10390EventTemplate(usernameText);

          // publish the username pubkey event
          await dispatch(
            publishEventTemplatePromiseAction.request({ eventTemplate }),
          );
          if (__DEV__) console.log("publish event");

          setUsernameText("");
          dispatch(settingsActions.setUsername(usernameText));
          setCurrentStep("finishScreen");
        } catch (error) {
          if (__DEV__) console.log("error publishing", error);
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
        if (__DEV__) console.log("nip5Result", npubResponse, npub);
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
      position: Toast.positions.CENTER,
    });
  };

  const handleGenKey = async () => {
    const hasKeyFromStorage = await getHasPrivateKeyInSecureStorage();
    if (!hasPrivateKeyFromRedux && !hasKeyFromStorage) {
      const { mnemonic } = generateSeedWords();
      await dispatch(
        setPrivateKeyPromiseAction.request({ mnemonic: mnemonic }),
      );
      setCurrentStep("setPubKeyScreen");
    }
  };

  const nextStepIsUser = async () => {
    // check to see if a key has been set
    const hasKeyFromStorage = await getHasPrivateKeyInSecureStorage();
    if (!hasPrivateKeyFromRedux && !hasKeyFromStorage) {
      // go to set key
      setCurrentStep("genKeyPairScreen");
    } else
      // skip key set to next step
      setCurrentStep("setPubKeyScreen");
  };

  const nextStepAccountError = async () => {
    setCurrentStep("isUserScreen");
  };

  const genKeyPairScreen = (
    <>
      <Text>Let's set a trustroots.org cryptographic key pair.</Text>

      <View style={styles.usernameContainer}>
        <Button
          title="Generate a new cryptographic key pair for me."
          onPress={handleGenKey}
        />
      </View>

      <Button
        onPress={() => setCurrentStep("setKeyMnemonicScreen")}
        title="I'd like to set my own cryptographic key."
      />
    </>
  );

  const setKeyMnemonicScreen = (
    <>
      <Text>Let's set a trustroots.org key.</Text>

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

        <Button onPress={handleMnemonicSubmit} title="Save" />
      </View>
    </>
  );

  const accountErrorScreen = (
    <>
      <Text>Looks like your trustroots.org account info is out of date.</Text>
      <Button onPress={nextStepAccountError} title="Continue" />
    </>
  );

  const isUserScreen = (
    <>
      <Text>Let's get you started setting up the app!</Text>

      <Text>Do you have a trustroots.org account?</Text>

      <View className="flex flex-col gap-2">
        <OpenTrustRootsButton
          url={"https://www.trustroots.org/signup"}
          title={"No, create a trustroots.org account."}
        />

        <Button
          onPress={nextStepIsUser}
          title="Yes, I already have an account."
        />
      </View>
    </>
  );

  const usernameScreen = (
    <>
      <Text>Set your trustroots.org username.</Text>

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

        <Button
          onPress={handleUsernameSubmit}
          disabled={isSubmitting}
          title={isSubmitting ? "Submitting..." : "Submit"}
        />
      </View>
    </>
  );

  const setPubKeyScreen = (
    <>
      <Text>
        Copy your public key and set your public key on your trustroots.org
        profile.
      </Text>

      <Text>Public Key: {npub}</Text>

      <View className="flex flex-col gap-2">
        <Button
          onPress={() => handleCopy(npub)}
          title="Copy Public Key to Clipboard"
        />

        <OpenTrustRootsButton
          url={`https://www.trustroots.org/profile/edit/networks`}
          title={"Set Public Key (trustroots.org)"}
        />

        <Button
          onPress={() => setCurrentStep("usernameScreen")}
          title="I set my key"
        />
      </View>
    </>
  );

  const finishScreen = (
    <View>
      <Text>Thanks {username}, you're all set!</Text>
      <Button onPress={() => setModalVisible(false)} title="Close" />
    </View>
  );

  let stepScreen;
  switch (currentStep) {
    case "accountErrorScreen":
      stepScreen = accountErrorScreen;
      break;
    case "isUserScreen":
      stepScreen = isUserScreen;
      break;
    case "usernameScreen":
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
    <View className="absolute inset-0 p-safe-offset-6 px-safe-offset-12 bg-white flex justify-center items-center gap-6">
      <TextClassContext.Provider value="text-center">
        {stepScreen}
      </TextClassContext.Provider>

      <Button
        variant="outline"
        onPress={() => setModalVisible(false)}
        title="Close"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  modalText: {
    fontSize: 20,
    marginBottom: 20,
    textAlign: "center",
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
