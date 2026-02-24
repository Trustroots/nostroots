import { Text } from "@/components/ui/text";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getBech32PrivateKey } from "nip06";
import { useState } from "react";
import { ScrollView, Switch, TextInput, View } from "react-native";

import BuildData from "@/components/BuildData";
import { KeyInput } from "@/components/KeyInput";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import {
  SECURE_STORE_PRIVATE_KEY_HEX_KEY,
  SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
} from "@/constants";
import { useNotifications } from "@/hooks/useNotifications";
import {
  getPrivateKeyHexFromSecureStorage,
  getPrivateKeyMnemonicFromSecureStorage,
} from "@/nostr/keystore.nostr";
import { setVisiblePlusCodes } from "@/redux/actions/map.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { sendNotificationSubscriptionEventAction } from "@/redux/sagas/notifications.saga";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { notificationsActions } from "@/redux/slices/notifications.slice";
import {
  ColorSchemePreference,
  selectFeatureFlags,
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";
import { getFirstLabelValueFromEvent } from "@trustroots/nr-common";
import Toast from "react-native-root-toast";
import { openEvent } from "@/startup/notifications.startup";
import { useKeyImport } from "@/hooks/useKeyImport";

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
      <Switch
        value={value}
        onChange={onToggle}
        trackColor={{ false: "#767577", true: "#0d9488" }}
      />
      <Text variant="small">{label}</Text>
    </View>
  );
};

const APPEARANCE_OPTIONS: { value: ColorSchemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function AppearanceSection() {
  const dispatch = useAppDispatch();
  const colorScheme = useAppSelector(settingsSelectors.selectColorScheme);

  return (
    <Section>
      <Text variant="h2">Appearance</Text>
      <View className="flex flex-row gap-2">
        {APPEARANCE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={colorScheme === option.value ? "default" : "outline"}
            size="sm"
            title={option.label}
            onPress={() =>
              dispatch(settingsActions.setColorScheme(option.value))
            }
          />
        ))}
      </View>
    </Section>
  );
}

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const { expoPushToken } = useNotifications();
  const { importKey, isImporting } = useKeyImport();

  const username = useAppSelector(settingsSelectors.selectUsername) as string;

  const areTestFeaturesEnabled = useAppSelector(
    settingsSelectors.selectAreTestFeaturesEnabled,
  ) as boolean;

  // Onboarding configuration flags.
  const { useSkipOnboarding, forceOnboarding, forceWelcome } =
    useAppSelector(selectFeatureFlags);

  const [nsec, setNsec] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [keyInput, setKeyInput] = useState("");

  const npub = useAppSelector(keystoreSelectors.selectPublicKeyNpub) as string;
  const publicKeyHex = useAppSelector(
    keystoreSelectors.selectPublicKeyHex,
  ) as string;

  const enablePlusCodeMapTEMPORARY = useAppSelector(
    mapSelectors.selectEnablePlusCodeMapTEMPORARY,
  ) as boolean;

  const notificationSubscriptionsJson = useAppSelector((state) =>
    JSON.stringify(state.notifications),
  );

  const deviceIsRegisteredForNotifications = useAppSelector((state) =>
    state.notifications.tokens.some((t) => t.expoPushToken === expoPushToken),
  );

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
      const keyHex = await getPrivateKeyHexFromSecureStorage();
      const { bech32PrivateKey } = getBech32PrivateKey({
        privateKey: keyHex,
      });
      setNsec(bech32PrivateKey);
    } catch {
      setNsec("Failed to load nsec");
    }

    try {
      const mnemonic = await getPrivateKeyMnemonicFromSecureStorage();
      setMnemonic(mnemonic);
    } catch {
      setMnemonic("Failed to find mnemonic");
    }
  };

  const inputClassName = "border border-border rounded px-3 py-2 bg-background";

  const hasUsernameOrHasTestFeaturesEnabled =
    (typeof username === "string" && username.length > 0) ||
    areTestFeaturesEnabled;

  const handleEnableNotifications = () => {
    dispatch(notificationsActions.setExpoPushToken(expoPushToken));
  };

  const handleDisableNotifications = () => {
    dispatch(notificationsActions.removeExpoPushToken(expoPushToken));
  };

  const handleResetSubscriptions = async () => {
    try {
      dispatch(notificationsActions.removeAllFilters());
      console.log("#odQ9ry start");
      await dispatch(sendNotificationSubscriptionEventAction.request());
      console.log("#odQ9ry finish");
      Toast.show("All subscriptions removed.");
    } catch (error) {
      Toast.show(`#hh2gOl Error: ${error}`);
    }
  };

  const handleImportKey = async () => {
    const success = await importKey(keyInput);

    if (success) {
      setKeyInput("");
      Toast.show("Key imported successfully", {
        duration: Toast.durations.SHORT,
        position: Toast.positions.BOTTOM,
      });
    } else {
      Toast.show(
        "Failed to import key. Please check your input and try again.",
        {
          duration: Toast.durations.LONG,
        },
      );
    }
  };

  return (
    <ScrollView contentContainerClassName="p-safe-offset-4 bg-background">
      <Text variant="h1">Settings</Text>

      {hasUsernameOrHasTestFeaturesEnabled ? (
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
          <TextInput className={inputClassName} value={mnemonic} />

          <Button title="Show nsec" onPress={showNsec} />
        </Section>
      ) : null}

      <Section>
        <Text variant="h2">Notifications</Text>

        {deviceIsRegisteredForNotifications ? (
          <Button
            title="Disable notifications for this device"
            onPress={handleDisableNotifications}
            variant="destructive"
          />
        ) : (
          <Button
            title="Enable notifications for this device"
            onPress={handleEnableNotifications}
          />
        )}

        <Button
          title="Reset all subscriptions"
          onPress={handleResetSubscriptions}
          variant="outline"
        />
      </Section>

      <Section>
        <Text variant="h2">Import Key</Text>
        <Text variant="p">
          If you have an existing Nostr key, import it here to enable posting.
          You can paste either an nsec key or a 12-word mnemonic phrase.
        </Text>

        <View className="bg-muted rounded-lg p-4 gap-4 mt-4">
          <KeyInput
            value={keyInput}
            onChangeText={setKeyInput}
            disabled={isImporting}
          />
          <Button
            size="lg"
            title={isImporting ? "Importing..." : "Import Key"}
            onPress={handleImportKey}
            disabled={isImporting}
          />
        </View>
      </Section>

      {areTestFeaturesEnabled ? (
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
            <Text variant="h2">Notification Debug</Text>
            <Text className="font-bold">Expo Push Token</Text>

            <TextInput className={inputClassName} value={expoPushToken} />

            <Button
              title="Reset all subscription filters"
              onPress={handleResetSubscriptions}
            />

            <Text>Subscription data</Text>
            <TextInput
              className={inputClassName}
              value={notificationSubscriptionsJson}
            />
          </Section>

          <Text variant="h2">Utils</Text>
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

          <Button
            title="Clear SecureStorage"
            onPress={async () => {
              try {
                await SecureStore.deleteItemAsync(
                  SECURE_STORE_PRIVATE_KEY_HEX_KEY,
                );
                await SecureStore.deleteItemAsync(
                  SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
                );
                Toast.show("SecureStorage successfully cleared", {
                  duration: Toast.durations.SHORT,
                });
              } catch (error) {
                Toast.show(`Error clearing SecureStorage: ${error}`, {
                  duration: Toast.durations.SHORT,
                });
              }
            }}
          />

          <Button title="Simulate Open Event" onPress={centerMapOnPlusCode} />
        </Section>
      ) : null}

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

      <AppearanceSection />

      <Section>
        <ToggleSwitch
          label="Developer Mode"
          value={areTestFeaturesEnabled}
          onToggle={() => {
            dispatch(settingsActions.toggleTestFeatures());
          }}
        />
      </Section>

      {areTestFeaturesEnabled && (
        <Section>
          <Text variant="h2">Onboarding / Welcome Flags</Text>

          <ToggleSwitch
            label="Allow skipping onboarding flow"
            value={useSkipOnboarding}
            onToggle={() => {
              dispatch(
                settingsActions.setUseSkipOnboarding(!useSkipOnboarding),
              );
            }}
          />

          <ToggleSwitch
            label="Force onboarding on startup"
            value={forceOnboarding}
            onToggle={() => {
              dispatch(settingsActions.setForceOnboarding(!forceOnboarding));
            }}
          />

          <ToggleSwitch
            label="Force welcome on startup"
            value={forceWelcome}
            onToggle={() => {
              dispatch(settingsActions.setForceWelcome(!forceWelcome));
            }}
          />
        </Section>
      )}
    </ScrollView>
  );
}
