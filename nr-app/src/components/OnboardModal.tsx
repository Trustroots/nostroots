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

import Toast from "react-native-root-toast";

import {
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { useState } from "react";

// import { getNip5PubKey } from "@trustroots/nr-common";
import { getNip5PubKey } from "../../../nr-common/utils.ts";

interface OnboardModalProps {
  npub: string | undefined;
  // setModalVisible:
  setModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function OnboardModal({
  npub,
  setModalVisible,
}: OnboardModalProps) {
  const dispatch = useAppDispatch();

  const username = useAppSelector(settingsSelectors.selectUsername);

  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [nip5VerificationLoading, setNip5VerificationLoading] =
    useState<boolean>(false);

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

  const handleCopy = async (npub: string | undefined) => {
    await Clipboard.setStringAsync(npub || "");
    Toast.show("Copied public key to Clipboard!", {
      duration: Toast.durations.LONG,
      position: Toast.positions.TOP,
    });
  };

  return (
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
          <Text style={styles.usernameLabel}>trustroots.org username:</Text>
          <TextInput
            style={[
              styles.usernameInput,
              error ? styles.usernameInputError : null,
            ]}
            value={text}
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
