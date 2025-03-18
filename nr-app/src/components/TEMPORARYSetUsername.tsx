import { publishEventTemplatePromiseAction } from "@/redux/actions/publish.actions";
import { useAppDispatch } from "@/redux/hooks";
import { getSerializableError } from "@/utils/error.utils";
import {
  getCurrentTimestamp,
  TRUSTROOTS_PROFILE_KIND,
  TRUSTROOTS_USERNAME_LABEL_NAMESPACE,
} from "@trustroots/nr-common";
import { EventTemplate } from "nostr-tools";
import { Fragment, useState } from "react";
import { Button, StyleSheet, Text, TextInput } from "react-native";
import Toast from "react-native-root-toast";

export default function TEMPORARYSetUsername() {
  const dispatch = useAppDispatch();
  const [username, setUsername] = useState("");

  return (
    <Fragment>
      <Text style={styles.inputLabel}>Trustroots username:</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoComplete="username"
        autoCorrect={false}
      />
      <Button
        title="Save trustroots username to nostr profile"
        onPress={async () => {
          try {
            const eventTemplate: EventTemplate = {
              kind: TRUSTROOTS_PROFILE_KIND,
              tags: [
                ["L", TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
                ["l", username, TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
              ],
              content: "",
              created_at: getCurrentTimestamp(),
            };
            await dispatch(
              publishEventTemplatePromiseAction.request({ eventTemplate }),
            );
            Toast.show("Successfully published event #Tm35Hu");
          } catch (error) {
            const serializeableError = getSerializableError(error);
            Toast.show(
              `Error sending profile event #grC53G ${serializeableError.toString()}`,
            );
          }
        }}
      />
    </Fragment>
  );
}

const styles = StyleSheet.create({
  inputLabel: {
    fontSize: 15,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 10,
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
