import { useRouter } from "expo-router";
import { nip19 } from "nostr-tools";
import React, { useCallback, useEffect, useState } from "react";
import { TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text, TextClassContext } from "@/components/ui/text";
import { useAppDispatch } from "@/redux/hooks";
import { setPrivateKeyPromiseAction } from "@/redux/sagas/keystore.saga";
import * as Clipboard from "expo-clipboard";
import { KeyIcon } from "lucide-react-native";
import { generateSeedWords } from "nip06";

export default function OnboardingKeyScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [currentTab, setCurrentTab] = useState<"existing" | "generate">(
    "generate",
  );

  const [existingKeyInput, setExistingKeyInput] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [isSavingKey, setIsSavingKey] = useState(false);

  const [mnemonic, setMnemonic] = useState("Loading...");
  const [mnemonicConfirmed, setMnemonicConfirmed] = useState(false);
  const [mnemonicError, setMnemonicError] = useState<string | null>(null);

  useEffect(() => {
    setMnemonic(generateSeedWords().mnemonic);
  }, []);

  const saveExistingKey = async () => {
    setKeyError(null);

    if (!existingKeyInput.trim()) {
      setKeyError("Enter your secret key to continue.");
      return;
    }

    let privateKeyHex = existingKeyInput.trim();

    try {
      if (privateKeyHex.startsWith("nsec")) {
        const decoded = nip19.decode(privateKeyHex);
        if (decoded.type === "nsec") {
          privateKeyHex = Buffer.from(decoded.data as Uint8Array).toString(
            "hex",
          );
        } else {
          throw new Error("Invalid nsec");
        }
      }
    } catch {
      setKeyError("That key format does not look right. Check and try again.");
      return;
    }

    setIsSavingKey(true);
    try {
      await dispatch(setPrivateKeyPromiseAction.request({ privateKeyHex }));
    } catch (error) {
      console.error("Failed to save key", error);
      setKeyError("We could not save this key. Please check and try again.");
    } finally {
      setIsSavingKey(false);
    }
  };

  const saveGeneratedMnemonic = async () => {
    if (!mnemonic || !mnemonicConfirmed) {
      setMnemonicError("Please save and confirm your words before continuing.");
      return;
    }

    setIsSavingKey(true);
    try {
      dispatch(setPrivateKeyPromiseAction.request({ mnemonic }));
    } catch (error) {
      console.error("Failed to save mnemonic", error);
      setMnemonicError("We could not set up this key. Please try again.");
    } finally {
      setIsSavingKey(false);
    }
  };

  const goBack = () => {
    router.back();
  };

  const goNext = useCallback(async () => {
    if (currentTab === "existing") {
      await saveExistingKey();
    } else {
      await saveGeneratedMnemonic();
    }

    router.push("/onboarding/link");
  }, [currentTab, saveExistingKey, saveGeneratedMnemonic, router]);

  const canContinue =
    currentTab === "existing"
      ? existingKeyInput.trim().length > 0 && !isSavingKey && !keyError
      : mnemonicConfirmed;

  return (
    <View className="flex flex-col items-center justify-center gap-8 px-6">
      <View className="flex items-center gap-6">
        <KeyIcon size={128} color="#fff" strokeWidth={0.5} />

        <Text variant="h1" className="my-0">
          Set Up Your Key
        </Text>
      </View>

      <Text className="text-center leading-relaxed">
        Choose whether to import an existing Nostr key or create a new one. Your
        secret key never leaves this device.
      </Text>

      <View className="flex w-full flex-col gap-6">
        <Tabs
          value={currentTab}
          onValueChange={(value) =>
            setCurrentTab(value as "existing" | "generate")
          }
        >
          <TabsList>
            <TabsTrigger value="existing">
              <Text>Import</Text>
            </TabsTrigger>
            <TabsTrigger value="generate">
              <Text>Generate</Text>
            </TabsTrigger>
          </TabsList>

          <TextClassContext.Provider value="text-black">
            <TabsContent
              value="existing"
              className="bg-white rounded-lg p-4 gap-4 w-full"
            >
              <TextInput
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={existingKeyInput}
                onChangeText={setExistingKeyInput}
                placeholder="Paste your secret key"
                className="border border-gray-200 rounded-lg p-3 text-sm"
              />
              {keyError && (
                <Text className="text-xs text-red-500">{keyError}</Text>
              )}
              <Button
                size="lg"
                title={isSavingKey ? "Saving..." : "Save"}
                disabled={isSavingKey}
                onPress={saveExistingKey}
              />
            </TabsContent>
            <TabsContent
              value="generate"
              className="bg-white rounded-lg p-4 gap-2"
            >
              <Text className="text-sm font-mono border border-gray-200 rounded-md p-3">
                {mnemonic}
              </Text>
              <View className="flex flex-row gap-2">
                <Button
                  className="w-1/2"
                  size="sm"
                  variant="outline"
                  title="Copy"
                  onPress={async () => {
                    try {
                      await Clipboard.setStringAsync(mnemonic);
                      const Toast = (await import("react-native-root-toast"))
                        .default;
                      Toast.show("Copied words to Clipboard!", {
                        duration: Toast.durations.SHORT,
                        position: Toast.positions.BOTTOM,
                      });
                    } catch (error) {
                      console.error(
                        "Failed to copy mnemonic to clipboard",
                        error,
                      );
                    }
                  }}
                />
                <Button
                  className="flex-1"
                  size="sm"
                  variant="outline"
                  title="Regenerate"
                  onPress={() => {
                    setMnemonic(generateSeedWords().mnemonic);
                    setMnemonicConfirmed(false);
                    setMnemonicError(null);
                  }}
                />
              </View>
              <Button
                size="sm"
                variant={mnemonicConfirmed ? "secondary" : "outline"}
                title={
                  mnemonicConfirmed
                    ? "Saved"
                    : "I have saved these words safely"
                }
                onPress={() => setMnemonicConfirmed(true)}
              />
              {mnemonicError && (
                <Text className="text-xs text-red-500">{mnemonicError}</Text>
              )}
            </TabsContent>
          </TextClassContext.Provider>
        </Tabs>
      </View>

      <View className="flex flex-row gap-2">
        {router.canGoBack() && (
          <Button variant="secondary" onPress={goBack} size="lg" title="Back" />
        )}
        <Button
          variant="secondary"
          onPress={goNext}
          size="lg"
          title={isSavingKey ? "Saving..." : "Continue"}
          disabled={!canContinue}
        />
      </View>

      <Text className="text-xs text-center">
        After this step, your private key is stored securely on this device. It
        is your responsibility to back it up and never share it with anyone.
        There is no way to restore your key if you lose it.
      </Text>
    </View>
  );
}
