import { Text } from "@/components/ui/text";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBech32PrivateKey } from "nip06";
import { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";

import BuildData from "@/components/BuildData";
import OnboardModal from "@/components/OnboardModal";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
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
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import {
  notificationsActions,
  notificationsSlice,
} from "@/redux/slices/notifications.slice";
import {
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";
import { openEvent } from "@/utils/notifications.utils";
import { getFirstLabelValueFromEvent } from "@trustroots/nr-common";
import Toast from "react-native-root-toast";

const ToggleSwitch = ({
  value,
  onToggle,
  label,
}: {
  value: boolean;
  onToggle: () => void;
  label: string;
}) => {
  return (
    <View className="flex flex-row gap-2 items-center">
      <Switch value={value} onChange={onToggle} />
      <Text variant="small">{label}</Text>
    </View>
  );
};

export default function SettingsScreen() {
  const { expoPushToken } = useNotifications();

  const username = useAppSelector(settingsSelectors.selectUsername) as string;

  const areTestFeaturesEnabled = useAppSelector(
    settingsSelectors.selectAreTestFeaturesEnabled,
  ) as boolean;

  const [nsec, setNsec] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [mnemonicInput, setMnemonicInput] = useState("");
  const [showUpdateButton, setShowUpdateButton] = useState(false);
  const [mnemonicError, setMnemonicError] = useState<string | null>(null);

  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub) as string;
  const publicKeyHex = useAppSelector(
    keystoreSelectors.selectPublicKeyHex,
  ) as string;

  const dispatch = useAppDispatch();

  const enablePlusCodeMapTEMPORARY = useAppSelector(
    mapSelectors.selectEnablePlusCodeMapTEMPORARY,
  ) as boolean;

  const [modalVisible, setModalVisible] = useState(false);

  const centerMapOnPlusCode = async () => {
    const testEventData = {
      name: "full event data",
      event: {
        content: "Why is this rendering?",
        created_at: 1732556890,
        id: "bac235d27263d11b81358715c8094048af87950092a2738f481dddbd5c7d9a4a",
        kind: 30397,
        pubkey:
          "dfc6060909365e5234e44ac64ffcd8b115d7b80d3025af7642826383fe8473b8",
        sig: "239515bee5f38fa244f51ba4dd6432f32eab1a74fa1898fb9c81e22898be1ab66ed4333ab7756732e43cfed353254085c607f3573fb5f8478157f547e5fbf91e",
        tags: [
          ["d", "37RSmSWyIio1HgFku7kPn"],
          ["L", "open-location-code"],
          ["l", "8CFJ2J7C+H8", "open-location-code"],
          ["L", "open-location-code-prefix"],
          [
            "l",
            "8C000000+",
            "8CFJ0000+",
            "8CFJ2J00+",
            "8CFJ2J7C+",
            "open-location-code-prefix",
          ],
        ],
      },
      metadata: {
        seenOnRelays: ["wss://relay.trustroots.org"],
      },
      author: {
        publicKey:
          "dfc6060909365e5234e44ac64ffcd8b115d7b80d3025af7642826383fe8473b8",
      },
    };

    // get the event
    const event = testEventData.event;

    // get the plus code from the event
    const plusCode = getFirstLabelValueFromEvent(event, "open-location-code");

    if (plusCode) {
      openEvent(plusCode, event);
    }
  };

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

  const handleMnemonicSubmit = async () => {
    if (mnemonicInput.trim() !== "") {
      try {
        setMnemonicError(null);
        await dispatch(
          setPrivateKeyMnemonicPromiseAction.request(mnemonicInput),
        );
        const pubKeyHex = derivePublicKeyHexFromMnemonic(mnemonicInput);
        dispatch(setPublicKeyHex(pubKeyHex));
        setMnemonicInput("");
        setShowUpdateButton(false);
        Toast.show("Mnemonic updated successfully", {
          duration: Toast.durations.SHORT,
        });
      } catch {
        setMnemonicError("Invalid mnemonic. Please check and try again.");
      }
    }
  };

  const inputClassName = "border border-gray-300 rounded px-3 py-2 bg-white";

  return (
    <ScrollView contentContainerClassName="p-safe-offset-4 bg-white">
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

      <Text variant="h1">Settings</Text>

      {username === "" ||
        (areTestFeaturesEnabled && (
          <Button
            title="Link Your Trustroots.org Profile"
            onPress={() => setModalVisible(true)}
          />
        ))}

      {(username && username.length > 0) || areTestFeaturesEnabled ? (
        <Section>
          <Text className="font-bold">trustroots.org username:</Text>
          <Text className={inputClassName}>{username}</Text>

          <Text className="font-bold">npub</Text>
          <TextInput className={inputClassName} value={npub} />

          <Text className="font-bold">public key hex</Text>
          <TextInput className={inputClassName} value={publicKeyHex} />

          <Text className="font-bold">nsec</Text>
          <TextInput className={inputClassName} value={nsec} />

          <Text className="font-bold">nsec mnemonic</Text>
          <TextInput
            className={inputClassName}
            value={mnemonicInput}
            onChangeText={handleMnemonicChange}
          />

          {mnemonicError && (
            <Text style={styles.errorText}>{mnemonicError}</Text>
          )}

          <Button title="Simulate Open Event" onPress={centerMapOnPlusCode} />

          {showUpdateButton && (
            <Button title="Save New Mnemonic" onPress={handleMnemonicSubmit} />
          )}
          <Button title="Show nsec" onPress={showNsec} />
        </Section>
      ) : null}

      {areTestFeaturesEnabled && (
        <Section>
          <ToggleSwitch
            label="Enable the experimental plus code map"
            value={enablePlusCodeMapTEMPORARY}
            onToggle={() => {
              dispatch(mapActions.togglePlusCodeMapTEMPORARY());
            }}
          />

          <BuildData />
          <Text className="font-bold">relays</Text>
          <TextInput
            className={inputClassName}
            value="['relay.trustroots.org']"
          />

          <Section>
            <Text variant="h2">Notifications</Text>
            <Text className="font-bold">expo push token</Text>
            <TextInput className={inputClassName} value={expoPushToken} />
            <Button
              title="Register this device for push notifications"
              onPress={() => {
                dispatch(notificationsActions.setExpoPushToken(expoPushToken));
              }}
            />
            <Button
              title="Reset all subscription filters"
              onPress={() => {
                dispatch(notificationsActions.removeAllFilters());
              }}
            />
          </Section>

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

          <Button
            title="Clear AsyncStorage"
            onPress={async () => {
              try {
                await AsyncStorage.clear();
                Toast.show("AsyncStorage successfully cleared", {
                  duration: Toast.durations.SHORT,
                });
              } catch (error) {
                Toast.show(`Error clearing AsyncStorage: ${error}`, {
                  duration: Toast.durations.SHORT,
                });
              }
            }}
          />
        </Section>
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

      <Section>
        <Text variant="h2">Help</Text>

        <Text variant="h3">How does this work?</Text>

        <Text variant="p">
          After linking your trustroots profile to this application you can
          leave semi-public notes on the map. You can see notes on the map left
          by others, or notes that relate to other projects like hitchwiki and
          hitchmap.
        </Text>

        <Text variant="h3">Where can I get help?</Text>

        <Text variant="p">
          If you encounter issues with this app, or want to share feedback, you
          can reach the team behind this at https://www.trustroots.org/support
          or simply leave a note in the Antarctica area.
        </Text>

        <Text variant="h3">How does this enhance Trustroots?</Text>

        <Text variant="p">
          Thanks for asking. Soon(tm): We hope we can quickly turn this into an
          application that is easier to use and has more activity than the
          previous meet functionality on Trustroots. We also want to integrate
          it with Trustroots circles. We want it to be a tool that can Help
          travellers and hosts connect in other ways besides the classical "I
          would like a place to stay next week". Try posting notes looking for a
          place, or use it to organize a last-minute potluck in the park.
        </Text>

        <Text variant="p">
          Mid-term: We want this app and Trustroots users to be able to interact
          with other applications, such as e.g. hitchmap.com build new
          applications e.g. for ridesharing or finding out where the cool events
          and parties are.
        </Text>

        <Text variant="p">
          Long-term: We strive to make the centralized Trustroots server and
          database and thus the official organization irrelevant.
        </Text>
      </Section>

      <Section>
        <ToggleSwitch
          label="Developer Mode"
          value={areTestFeaturesEnabled}
          onToggle={() => {
            dispatch(settingsActions.toggleTestFeatures());
          }}
        />
      </Section>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  settings: {
    backgroundColor: "#ffffff",
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
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
  },
  errorText: {
    color: "red",
    marginTop: 5,
    marginBottom: 10,
  },
});
