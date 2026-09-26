import { useRouter } from "expo-router";
import { ShieldCheckIcon } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { View } from "react-native";

import { BackupChallenge } from "@/components/BackupChallenge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ROUTES } from "@/constants/routes";
import {
  getHasPrivateKeyHexInSecureStorage,
  getHasPrivateKeyMnemonicInSecureStorage,
  getPrivateKeyHexFromSecureStorage,
  getPrivateKeyMnemonicFromSecureStorage,
} from "@/nostr/keystore.nostr";
import { getBech32PrivateKey } from "nip06";
import { trackEvent } from "@/services/analytics.service";

export default function OnboardingBackupConfirmScreen() {
  const router = useRouter();

  const [secret, setSecret] = useState<string | null>(null);
  const [secretAcknowledged, setSecretAcknowledged] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSecret() {
      try {
        const [hasHex, hasMnemonic] = await Promise.all([
          getHasPrivateKeyHexInSecureStorage(),
          getHasPrivateKeyMnemonicInSecureStorage(),
        ]);

        let loaded: string | null = null;

        if (hasMnemonic) {
          loaded = await getPrivateKeyMnemonicFromSecureStorage();
        } else if (hasHex) {
          const privateKey = await getPrivateKeyHexFromSecureStorage();
          loaded = getBech32PrivateKey({ privateKey }).bech32PrivateKey;
        }

        if (cancelled) return;

        if (!loaded) {
          setSetupError(
            "We could not find your key on this device. Please restart onboarding.",
          );
          return;
        }

        setSecret(loaded);
      } catch {
        if (!cancelled) {
          setSetupError(
            "We could not verify your key setup on this device. Please restart onboarding.",
          );
        }
      }
    }

    loadSecret();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAcknowledgeSecret = () => {
    trackEvent("onboarding_backup", {
      action: "secret_acknowledged",
      source: "bridge",
    });
    setSecretAcknowledged(true);
  };

  const handleConfirmed = () => {
    trackEvent("onboarding_backup_confirmed", {
      outcome: "success",
      source: "bridge",
    });
    setConfirmed(true);
  };

  const handleFailed = () => {
    trackEvent("onboarding_backup_confirmed", {
      outcome: "mismatch",
      source: "bridge",
    });
  };

  const handleFinish = () => {
    if (!confirmed) return;
    trackEvent("onboarding_completed", { method: "bridge" });
    router.replace(ROUTES.HOME);
  };

  const handleBack = () => {
    trackEvent("onboarding_backup", { action: "back", source: "bridge" });
    router.dismissTo("/onboarding/trustroots");
  };

  const isRevealStep = !secretAcknowledged;

  return (
    <>
      <View className="flex items-center gap-6">
        <ShieldCheckIcon size={128} color="#fff" strokeWidth={0.5} />
        <Text variant="h1" className="my-0">
          Save Your Key
        </Text>
      </View>

      <View className="w-full gap-3">
        <Text variant="p" className="mt-0">
          This secret is the key to your account and data. We cannot recover it
          if you lose it.
        </Text>
        <Text variant="p">
          {isRevealStep
            ? "Write it down or store it in a password manager. Then we ask you for a few parts of it, to check it really is saved."
            : "Now check your backup — we only ask for a few parts of it."}
        </Text>
      </View>

      {setupError && (
        <Text className="text-xs text-red-500 text-left">{setupError}</Text>
      )}

      {secret && isRevealStep && (
        <>
          <View className="w-full gap-2 bg-card rounded-lg p-3">
            <Text className="text-sm font-bold text-foreground text-left">
              Your secret
            </Text>
            <Text
              testID="onboarding-backup-secret"
              className="text-sm bg-muted text-foreground rounded-md p-3 text-left"
              selectable
            >
              {secret}
            </Text>
          </View>
          <Button
            testID="onboarding-backup-secret-saved"
            variant="secondary"
            size="lg"
            title="I have saved my secret"
            onPress={handleAcknowledgeSecret}
          />
        </>
      )}

      {secret && !isRevealStep && (
        <BackupChallenge
          key={secret}
          secret={secret}
          confirmed={confirmed}
          onConfirmed={handleConfirmed}
          onFailed={handleFailed}
          testIDPrefix="onboarding-backup"
        />
      )}

      <View className="flex flex-row gap-2 mt-4">
        <Button
          variant="secondary"
          onPress={handleBack}
          size="lg"
          title="Back"
        />

        <Button
          testID="onboarding-backup-finish"
          variant="secondary"
          size="lg"
          title="Finish"
          onPress={handleFinish}
          disabled={!confirmed}
        />
      </View>
    </>
  );
}
