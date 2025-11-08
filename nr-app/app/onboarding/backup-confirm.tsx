import { useRouter } from "expo-router";
import { ShieldCheckIcon } from "lucide-react-native";
import { nip19 } from "nostr-tools";
import React, { useEffect, useState } from "react";
import { TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  getHasPrivateKeyHexInSecureStorage,
  getHasPrivateKeyMnemonicInSecureStorage,
  getPrivateKeyHexFromSecureStorage,
  getPrivateKeyMnemonicFromSecureStorage,
} from "@/nostr/keystore.nostr";
import { getBech32PrivateKey } from "nip06";

async function verifyBackupInput(rawInput: string): Promise<boolean> {
  const input = rawInput.trim();
  if (!input) return false;

  let expectedNsec: string | null = null;
  let expectedMnemonic: string | null = null;

  const hasHex = await getHasPrivateKeyHexInSecureStorage();
  if (hasHex) {
    const privateKey = await getPrivateKeyHexFromSecureStorage();
    try {
      const { bech32PrivateKey: nsec } = getBech32PrivateKey({ privateKey });
      expectedNsec = nsec;
    } catch {
      expectedNsec = null;
    }
  }

  try {
    const hasMnemonic = await getHasPrivateKeyMnemonicInSecureStorage();
    if (hasMnemonic) {
      const storedMnemonic = await getPrivateKeyMnemonicFromSecureStorage();
      const normalizedStored = storedMnemonic
        .trim()
        .split(/\s+/)
        .join(" ")
        .toLowerCase();
      if (normalizedStored.length > 0) {
        expectedMnemonic = normalizedStored;
      }
    }
  } catch {
    // ignore, handled via null checks
  }

  if (!expectedNsec && !expectedMnemonic) {
    return false;
  }

  if (input.toLowerCase().startsWith("nsec1")) {
    const candidateNsec = input.trim().toLowerCase();
    if (expectedNsec && candidateNsec === expectedNsec.toLowerCase()) {
      return true;
    }
    return false;
  }

  const candidateMnemonic = input.trim().split(/\s+/).join(" ").toLowerCase();

  if (expectedMnemonic && candidateMnemonic === expectedMnemonic) {
    return true;
  }

  return false;
}

export default function OnboardingBackupConfirmScreen() {
  const router = useRouter();

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkSecrets() {
      try {
        const [hasHex, hasMnemonic] = await Promise.all([
          getHasPrivateKeyHexInSecureStorage(),
          getHasPrivateKeyMnemonicInSecureStorage(),
        ]);

        if (!hasHex && !hasMnemonic) {
          if (!cancelled) {
            setSetupError(
              "We could not find your key on this device. Please restart onboarding.",
            );
          }
        }
      } catch {
        if (!cancelled) {
          setSetupError(
            "We could not verify your key setup on this device. Please restart onboarding.",
          );
        }
      }
    }

    checkSecrets();

    return () => {
      cancelled = true;
      setError(null);
      setSuccess(false);
    };
  }, []);

  const handleConfirm = async () => {
    if (setupError) return;

    const trimmed = input.trim();
    if (!trimmed) {
      setError("Enter your nsec or mnemonic to confirm your backup.");
      setSuccess(false);
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const ok = await verifyBackupInput(trimmed);
      if (!ok) {
        setSuccess(false);
        setError(
          "That does not match your saved secret. Double-check and try again.",
        );
      } else {
        setSuccess(true);
        setError(null);
        setInput("");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFinish = () => {
    if (!success) return;
    setInput("");
    setError(null);
    router.replace("/(tabs)");
  };

  const handleBack = () => {
    setInput("");
    setError(null);
    setSuccess(false);
    router.dismissTo("/onboarding/key");
  };

  const isConfirmDisabled =
    !!setupError || isVerifying || success || !input.trim().length;

  return (
    <View className="flex grow flex-col items-center justify-center gap-8 px-6">
      <View className="flex items-center gap-6">
        <ShieldCheckIcon size={128} color="#fff" strokeWidth={0.5} />
        <Text variant="h1" className="my-0">
          Confirm Your Backup
        </Text>
      </View>

      <View className="w-full gap-3">
        <Text variant="p" className="mt-0">
          This secret is the key to your account and data. We cannot recover it
          if you lose it.
        </Text>
        <Text variant="p">
          Re-enter your nsec or your 12/24-word mnemonic to confirm you’ve saved
          it safely.
        </Text>
      </View>

      <View className="w-full gap-2">
        <TextInput
          value={input}
          onChangeText={(value) => {
            setInput(value);
            setError(null);
            setSuccess(false);
          }}
          placeholder="Paste your nsec1... key or type your 12/24-word mnemonic"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          className="w-full bg-white text-black rounded-md p-3 text-sm min-h-[72px]"
        />

        {error && <Text className="text-xs text-red-500 mt-1">{error}</Text>}

        {setupError && (
          <Text className="text-xs text-red-500 mt-1 text-left">
            {setupError}
          </Text>
        )}

        {success && !error && (
          <Text className="text-xs text-green-400 mt-1">
            You’re all set — backup confirmed.
          </Text>
        )}
      </View>

      <Button
        variant="secondary"
        size="lg"
        title={
          success
            ? "Backup confirmed"
            : isVerifying
              ? "Confirming..."
              : "Confirm backup"
        }
        disabled={isConfirmDisabled}
        onPress={handleConfirm}
      />

      <View className="flex flex-row gap-2 mt-4">
        <Button
          variant="secondary"
          onPress={handleBack}
          size="lg"
          title="Back"
        />

        <Button
          variant="secondary"
          size="lg"
          title="Finish"
          onPress={handleFinish}
          disabled={!success}
        />
      </View>
    </View>
  );
}
