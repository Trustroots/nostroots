import { useRouter } from "expo-router";
import { nip19 } from "nostr-tools";
import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text, TextClassContext } from "@/components/ui/text";
import { KeyInput } from "@/components/KeyInput";
import {
  getHasPrivateKeyInSecureStorage,
  getPrivateKeyHexFromSecureStorage,
} from "@/nostr/keystore.nostr";
import { useAppDispatch } from "@/redux/hooks";
import { setPrivateKeyPromiseAction } from "@/redux/sagas/keystore.saga";
import { bytesToHex } from "@noble/hashes/utils";
import { KeyIcon } from "lucide-react-native";
import { getBech32PrivateKey } from "nip06";
import Toast from "react-native-root-toast";

export default function OnboardingKeyScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [currentTab, setCurrentTab] = useState<"existing" | "generate">(
    "generate",
  );

  const [existingKeyInput, setExistingKeyInput] = useState<string>("");
  const [existingKeyStatus, setExistingKeyStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  const [keyError, setKeyError] = useState<string | null>(null);

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
    setKeyError(null);

    if (!existingKeyInput.trim()) {
      setKeyError("Enter your secret key to continue.");
      return;
    }

    let privateKey = existingKeyInput.trim();

    try {
      if (privateKey.startsWith("nsec")) {
        const decoded = nip19.decode(privateKey);
        if (decoded.type === "nsec") {
          privateKey = bytesToHex(decoded.data);
        } else {
          throw new Error("Invalid nsec");
        }
      }
    } catch {
      setKeyError("That key format does not look right. Check and try again.");
      return;
    }

    setExistingKeyStatus("saving");
    try {
      await dispatch(
        setPrivateKeyPromiseAction.request({ privateKeyHex: privateKey }),
      );
      setExistingKeyStatus("saved");
    } catch (error) {
      console.error("Failed to save key", error);
      setKeyError("We could not save this key. Please check and try again.");
      setExistingKeyStatus("idle");
    }
  };

  const saveGeneratedMnemonic = async () => {
    if (!mnemonic || !mnemonicConfirmed) {
      setMnemonicError("Please save and confirm your words before continuing.");
      return;
    }

    try {
      dispatch(setPrivateKeyPromiseAction.request({ mnemonic }));
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
      ? existingKeyInput.trim().length > 0 &&
        existingKeyStatus === "saved" &&
        !keyError
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
              className="bg-white rounded-lg p-4 gap-2 w-full"
            >
              {keyError && (
                <Text className="text-xs text-red-500">{keyError}</Text>
              )}
              <KeyInput
                value={existingKeyInput}
                onChangeText={setExistingKeyInput}
                placeholder="Paste your secret key"
                disabled={existingKeyStatus === "saving"}
              />
              <Button
                size="lg"
                title={
                  existingKeyStatus === "saved"
                    ? "Saved"
                    : existingKeyStatus === "saving"
                      ? "Saving..."
                      : "Save Key"
                }
                disabled={["saving", "saved"].includes(existingKeyStatus)}
                onPress={saveExistingKey}
              />
            </TabsContent>
            <TabsContent
              value="generate"
              className="bg-white rounded-lg p-4 gap-2"
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
