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
import { Button, TextInput } from "react-native";
import Toast from "react-native-root-toast";

import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";

export default function TEMPORARYSetUsername() {
  const dispatch = useAppDispatch();
  const [username, setUsername] = useState("");
  const colors = useThemeColors();

  return (
    <Fragment>
      <Text className="text-[15px] font-bold mx-2.5 my-2.5">
        Trustroots username:
      </Text>
      <TextInput
        className="h-10 mb-5 px-2.5 border border-border rounded bg-background text-foreground"
        placeholderTextColor={colors.mutedForeground}
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
