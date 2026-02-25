import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { KeyInput } from "@/components/KeyInput";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text, TextClassContext } from "@/components/ui/text";
import { useKeyImport } from "@/hooks/useKeyImport";
import {
  getHasPrivateKeyInSecureStorage,
  getPrivateKeyHexFromSecureStorage,
} from "@/nostr/keystore.nostr";
import { useAppDispatch } from "@/redux/hooks";
import { setPrivateKeyPromiseAction } from "@/redux/sagas/keystore.saga";
import { settingsActions } from "@/redux/slices/settings.slice";
import { KeyIcon } from "lucide-react-native";
import { getBech32PrivateKey } from "nip06";

export default function OnboardingKeyScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const {
    importKey,
    isImporting,
    error: importError,
    clearError,
  } = useKeyImport();

  const [currentTab, setCurrentTab] = useState<"existing" | "generate">(
    "generate",
  );

  const [existingKeyInput, setExistingKeyInput] = useState<string>("");
  const [keySaved, setKeySaved] = useState(false);

  const [mnemonic, setMnemonic] = useState("");
  const [mnemonicConfirmed, setMnemonicConfirmed] = useState(false);
  const [mnemonicError, setMnemonicError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const hasKeyFromStorage = await getHasPrivateKeyInSecureStorage();
      if (hasKeyFromStorage) {
        const privateKey = await getPrivateKeyHexFromSecureStorage();
        const { bech32PrivateKey: nsec } = getBech32PrivateKey({ privateKey });
        setExistingKeyInput(nsec);
        setCurrentTab("existing");
      }
    })();
  }, []);

  const handleRegenerateMnemonic = () => {
    setMnemonicConfirmed(false);
    setMnemonicError(null);
  };

  const saveExistingKey = async () => {
    clearError();
    const result = await importKey(existingKeyInput);
    if (result.success) {
      setKeySaved(true);
      dispatch(settingsActions.setKeyWasImported(true));
    }
  };

  const saveGeneratedMnemonic = async () => {
    if (!mnemonic || !mnemonicConfirmed) {
      setMnemonicError("Please save and confirm your words before continuing.");
      return;
    }

    try {
      dispatch(setPrivateKeyPromiseAction.request({ mnemonic }));
      dispatch(settingsActions.setKeyWasImported(false));
    } catch (error) {
      console.error("Failed to save mnemonic", error);
      setMnemonicError("We could not set up this key. Please try again.");
    }
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.dismissTo("/onboarding/identity");
    }
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
      ? existingKeyInput.trim().length > 0 && keySaved && !importError
      : mnemonicConfirmed;

  return (
    <>
      <View className="flex items-center gap-6">
        <KeyIcon size={128} color="#fff" strokeWidth={0.5} />

        <Text variant="h1" className="my-0">
          Set Up Your Key
        </Text>
      </View>

      <Text className="text-center leading-relaxed">
        Choose whether to import an existing Nostr key (nsec or mnemonic) or
        create a new one. Your secret key never leaves this device.
      </Text>

      <View className="flex w-full flex-col gap-6">
        <Tabs
          value={currentTab}
          onValueChange={(value) =>
            setCurrentTab(value as "existing" | "generate")
          }
        >
          <TabsList>
            <TabsTrigger value="generate">
              <Text>Generate</Text>
            </TabsTrigger>
            <TabsTrigger value="existing">
              <Text>Import</Text>
            </TabsTrigger>
          </TabsList>

          <TextClassContext.Provider value="text-foreground">
            <TabsContent
              value="existing"
              className="bg-card rounded-lg p-4 gap-2 w-full"
            >
              {importError && (
                <Text className="text-xs text-red-500">{importError}</Text>
              )}
              <KeyInput
                value={existingKeyInput}
                onChangeText={setExistingKeyInput}
                placeholder="Paste your nsec or mnemonic"
                disabled={isImporting}
              />
              <Button
                size="lg"
                title={keySaved ? "Saved" : isImporting ? "Saving..." : "Save"}
                disabled={isImporting || keySaved}
                onPress={saveExistingKey}
              />
            </TabsContent>
            <TabsContent
              value="generate"
              className="bg-card rounded-lg p-4 gap-2"
            >
              {mnemonicError && (
                <Text className="text-xs text-red-500">{mnemonicError}</Text>
              )}
              <KeyInput
                value={mnemonic}
                onChangeText={setMnemonic}
                placeholder=""
                disabled={false}
                generateMode={true}
                showRegenerateButton={true}
                onRegenerate={handleRegenerateMnemonic}
              />
              <Button
                size="lg"
                title={
                  mnemonicConfirmed
                    ? "Saved"
                    : "I have saved these words safely"
                }
                disabled={mnemonicConfirmed}
                onPress={() => setMnemonicConfirmed(true)}
              />
            </TabsContent>
          </TextClassContext.Provider>
        </Tabs>
      </View>

      <View className="flex flex-row gap-2">
        <Button
          variant="outline"
          textClassName="text-white"
          onPress={goBack}
          size="lg"
          title="Back"
        />
        <Button
          variant="secondary"
          onPress={goNext}
          size="lg"
          title={"Continue"}
          disabled={!canContinue}
        />
      </View>

      <Text className="text-xs text-center">
        After this step, your private key is stored securely on this device. It
        is your responsibility to back it up and never share it with anyone.
        There is no way to restore your key if you lose it.
      </Text>
    </>
  );
}
