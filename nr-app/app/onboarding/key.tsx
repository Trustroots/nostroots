import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { BackupChallenge } from "@/components/BackupChallenge";
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
import { trackEvent } from "@/services/analytics.service";

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
  const [mnemonicSaved, setMnemonicSaved] = useState(false);
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
    setMnemonicSaved(false);
    setMnemonicConfirmed(false);
    setMnemonicError(null);
  };

  const handleMnemonicSaved = () => {
    trackEvent("onboarding_backup", {
      action: "secret_acknowledged",
      source: "legacy_key",
    });
    setMnemonicError(null);
    setMnemonicSaved(true);
  };

  const handleMnemonicConfirmed = () => {
    trackEvent("onboarding_backup_confirmed", {
      outcome: "success",
      source: "legacy_key",
    });
    setMnemonicConfirmed(true);
  };

  const handleMnemonicChallengeFailed = () => {
    trackEvent("onboarding_backup_confirmed", {
      outcome: "mismatch",
      source: "legacy_key",
    });
  };

  const saveExistingKey = async () => {
    clearError();
    const result = await importKey(existingKeyInput);
    if (result.success) {
      setKeySaved(true);
      dispatch(settingsActions.setKeyWasImported(true));
      trackEvent("onboarding_key_saved", {
        method: result.type === "mnemonic" ? "mnemonic" : "nsec",
        outcome: "success",
      });
    } else {
      trackEvent("onboarding_key_saved", {
        method: "import",
        outcome: "failure",
      });
    }
  };

  const saveGeneratedMnemonic = useCallback(async () => {
    if (!mnemonic || !mnemonicConfirmed) {
      setMnemonicError(
        "Please save your words and confirm them before continuing.",
      );
      return;
    }

    try {
      dispatch(setPrivateKeyPromiseAction.request({ mnemonic }));
      dispatch(settingsActions.setKeyWasImported(false));
      trackEvent("onboarding_key_saved", {
        method: "generated",
        outcome: "success",
      });
    } catch (error) {
      trackEvent("onboarding_key_saved", {
        method: "generated",
        outcome: "failure",
      });
      console.error("Failed to save mnemonic", error);
      setMnemonicError("We could not set up this key. Please try again.");
    }
  }, [dispatch, mnemonic, mnemonicConfirmed]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.dismissTo("/onboarding/identity");
    }
  };

  const goNext = useCallback(async () => {
    if (currentTab === "generate") {
      await saveGeneratedMnemonic();
    }

    trackEvent("onboarding_key_completed", { method: currentTab });
    router.push("/onboarding/link");
  }, [currentTab, saveGeneratedMnemonic, router]);

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
        Generate a new Nostr key, or import one you already have. The next step
        shows you how to add it to your Trustroots profile.
      </Text>

      <View className="flex w-full flex-col gap-6">
        <Tabs
          value={currentTab}
          onValueChange={(value) => {
            const method = value as "existing" | "generate";
            setCurrentTab(method);
            trackEvent("onboarding_key_method_selected", { method });
          }}
        >
          <TabsList>
            <TabsTrigger testID="onboarding-key-tab-generate" value="generate">
              <Text>Generate</Text>
            </TabsTrigger>
            <TabsTrigger testID="onboarding-key-tab-import" value="existing">
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
                testID="onboarding-key-import-input"
                value={existingKeyInput}
                onChangeText={setExistingKeyInput}
                placeholder="Paste your nsec or mnemonic"
                disabled={isImporting}
                showPasteButton={true}
              />
              <Button
                testID="onboarding-key-import-save"
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
              {mnemonicSaved ? (
                <>
                  <BackupChallenge
                    key={mnemonic}
                    secret={mnemonic}
                    confirmed={mnemonicConfirmed}
                    onConfirmed={handleMnemonicConfirmed}
                    onFailed={handleMnemonicChallengeFailed}
                    testIDPrefix="onboarding-key-backup"
                  />
                  {!mnemonicConfirmed && (
                    <Button
                      testID="onboarding-key-mnemonic-show-again"
                      size="sm"
                      variant="outline"
                      title="Show my words again"
                      onPress={() => setMnemonicSaved(false)}
                    />
                  )}
                </>
              ) : (
                <>
                  <KeyInput
                    testID="onboarding-key-mnemonic-input"
                    value={mnemonic}
                    onChangeText={setMnemonic}
                    placeholder=""
                    disabled={false}
                    generateMode={true}
                    showRegenerateButton={true}
                    onRegenerate={handleRegenerateMnemonic}
                    showCopyButton={true}
                  />
                  <Button
                    testID="onboarding-key-mnemonic-confirm"
                    size="lg"
                    title="I have saved these words safely"
                    disabled={!mnemonic}
                    onPress={handleMnemonicSaved}
                  />
                </>
              )}
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
          testID="onboarding-key-continue"
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
