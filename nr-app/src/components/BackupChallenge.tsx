import React, { useMemo, useState } from "react";
import { TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  BackupChallenge as Challenge,
  checkBackupChallenge,
  createBackupChallenge,
} from "@/utils/backupChallenge.utils";

interface BackupChallengeProps {
  secret: string;
  confirmed: boolean;
  onConfirmed: () => void;
  onFailed?: () => void;
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
  onFailed,
  testIDPrefix,
}: BackupChallengeProps) {
  // Mount-time challenge; callers remount with key={secret} to reroll it.
  const [challenge] = useState<Challenge>(() => createBackupChallenge(secret));
  const [answers, setAnswers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fieldCount =
    challenge.type === "mnemonic" ? challenge.positions.length : 1;

  const prompt = useMemo(
    () =>
      challenge.type === "mnemonic"
        ? `Enter word ${formatPositions(challenge.positions)} from the backup you just saved.`
        : "Enter your secret from the backup you just saved.",
    [challenge],
  );

  const setAnswer = (index: number, value: string) => {
    setAnswers((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    setError(null);
  };

  const hasEveryAnswer = Array.from({ length: fieldCount }).every((_, index) =>
    (answers[index] ?? "").trim(),
  );

  const handleConfirm = () => {
    const filled = Array.from(
      { length: fieldCount },
      (_, index) => answers[index] ?? "",
    );

    if (checkBackupChallenge(challenge, secret, filled)) {
      setError(null);
      onConfirmed();
      return;
    }

    setError(
      challenge.type === "mnemonic"
        ? "That does not match your backup. Check the numbered words and try again."
        : "That does not match your backup. Check it and try again.",
    );
    onFailed?.();
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
                value={answers[index] ?? ""}
                onChangeText={(value) => setAnswer(index, value)}
                editable={!confirmed}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#6b7280"
                className="w-full bg-muted text-foreground rounded-md p-3 text-sm text-left"
              />
            </View>
          ))}
        </View>
      ) : (
        <TextInput
          testID={`${testIDPrefix}-secret`}
          value={answers[0] ?? ""}
          onChangeText={(value) => setAnswer(0, value)}
          editable={!confirmed}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          placeholder="nsec1..."
          placeholderTextColor="#6b7280"
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
    </View>
  );
}
