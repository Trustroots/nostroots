import React, { useState } from "react";
import { TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import { trackEvent } from "@/services/analytics.service";
import {
  BackupChallenge as Challenge,
  checkBackupChallenge,
  createBackupChallenge,
} from "@/utils/backupChallenge.utils";

interface BackupChallengeProps {
  secret: string;
  confirmed: boolean;
  onConfirmed: () => void;
  onShowAgain: () => void;
  showAgainTitle: string;
  analyticsSource: string;
  testIDPrefix: string;
}

function formatPositions(positions: number[]): string {
  const labels = positions.map((position) => `${position}`);
  const last = labels.pop();
  return labels.length ? `${labels.join(", ")} and ${last}` : `${last}`;
}

export function BackupChallenge({
  secret,
  confirmed,
  onConfirmed,
  onShowAgain,
  showAgainTitle,
  analyticsSource,
  testIDPrefix,
}: BackupChallengeProps) {
  const colors = useThemeColors();
  // Mount-time challenge; callers remount with key={secret} to reroll it.
  const [challenge] = useState<Challenge>(() => createBackupChallenge(secret));
  const isMnemonic = challenge.type === "mnemonic";
  const [answers, setAnswers] = useState<string[]>(() =>
    Array(challenge.type === "mnemonic" ? challenge.positions.length : 1).fill(
      "",
    ),
  );
  const [error, setError] = useState<string | null>(null);

  const prompt =
    challenge.type === "mnemonic"
      ? `Enter word ${formatPositions(challenge.positions)} from the backup you just saved.`
      : "Enter your secret from the backup you just saved.";

  const setAnswer = (index: number, value: string) => {
    setAnswers((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    setError(null);
  };

  const hasEveryAnswer = answers.every((answer) => answer.trim());

  const handleConfirm = () => {
    if (checkBackupChallenge(challenge, secret, answers)) {
      setError(null);
      trackEvent("onboarding_backup_confirmed", {
        outcome: "success",
        source: analyticsSource,
      });
      onConfirmed();
      return;
    }

    setError(
      isMnemonic
        ? "That does not match your backup. Check the numbered words and try again."
        : "That does not match your backup. Check it and try again.",
    );
    trackEvent("onboarding_backup_confirmed", {
      outcome: "mismatch",
      source: analyticsSource,
    });
  };

  const handleShowAgain = () => {
    trackEvent("onboarding_backup", {
      action: "show_again",
      source: analyticsSource,
    });
    onShowAgain();
  };

  return (
    <View className="w-full gap-3">
      <Text className="text-sm text-muted-foreground text-left">{prompt}</Text>

      {challenge.type === "mnemonic" ? (
        <View className="flex flex-row gap-2">
          {challenge.positions.map((position, index) => (
            <View key={position} className="flex-1 gap-1">
              <Text className="text-xs text-muted-foreground text-left">
                Word {position}
              </Text>
              <TextInput
                testID={`${testIDPrefix}-word-${position}`}
                accessibilityLabel={`Word ${position}`}
                value={answers[index]}
                onChangeText={(value) => setAnswer(index, value)}
                editable={!confirmed}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={colors.mutedForeground}
                className="w-full bg-muted text-foreground rounded-md p-3 text-sm text-left"
              />
            </View>
          ))}
        </View>
      ) : (
        <TextInput
          testID={`${testIDPrefix}-secret`}
          accessibilityLabel="Your full secret"
          value={answers[0]}
          onChangeText={(value) => setAnswer(0, value)}
          editable={!confirmed}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          placeholder="nsec1..."
          placeholderTextColor={colors.mutedForeground}
          className="w-full bg-muted text-foreground rounded-md p-3 text-sm min-h-[72px]"
        />
      )}

      {error && <Text className="text-xs text-red-500 text-left">{error}</Text>}

      {confirmed && (
        <Text className="text-xs text-green-400 text-left">
          Backup confirmed.
        </Text>
      )}

      <Button
        testID={`${testIDPrefix}-confirm`}
        variant="secondary"
        size="lg"
        title={confirmed ? "Backup confirmed" : "Confirm backup"}
        disabled={confirmed || !hasEveryAnswer}
        onPress={handleConfirm}
      />

      {!confirmed && (
        <Button
          testID={`${testIDPrefix}-show-again`}
          size="sm"
          variant="outline"
          title={showAgainTitle}
          onPress={handleShowAgain}
        />
      )}
    </View>
  );
}
