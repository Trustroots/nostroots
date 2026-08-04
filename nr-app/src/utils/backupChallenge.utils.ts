export type BackupChallenge =
  | { type: "mnemonic"; positions: number[] }
  | { type: "secret" };

const MNEMONIC_LENGTHS = [12, 15, 18, 21, 24];
const MNEMONIC_CHALLENGE_SIZE = 3;

function splitWords(secret: string): string[] {
  return secret.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function isMnemonicSecret(secret: string): boolean {
  return MNEMONIC_LENGTHS.includes(splitWords(secret).length);
}

/**
 * Positions are 1-based and returned in ascending order so the prompt reads
 * naturally ("words 4, 9 and 12").
 */
export function createBackupChallenge(
  secret: string,
  random: () => number = Math.random,
): BackupChallenge {
  if (!isMnemonicSecret(secret)) {
    return { type: "secret" };
  }

  const wordCount = splitWords(secret).length;
  // Draw without replacement so a degenerate `random` cannot loop forever.
  const remaining = Array.from({ length: wordCount }, (_, index) => index + 1);
  const positions: number[] = [];

  while (positions.length < MNEMONIC_CHALLENGE_SIZE) {
    const index = Math.min(
      remaining.length - 1,
      Math.max(0, Math.floor(random() * remaining.length)),
    );
    positions.push(remaining.splice(index, 1)[0]);
  }

  return {
    type: "mnemonic",
    positions: positions.sort((a, b) => a - b),
  };
}

export function checkBackupChallenge(
  challenge: BackupChallenge,
  secret: string,
  answers: string[],
): boolean {
  if (challenge.type === "secret") {
    const expected = secret.trim().toLowerCase();
    const given = (answers[0] ?? "").trim().toLowerCase();
    return expected.length > 0 && given === expected;
  }

  const words = splitWords(secret);
  if (answers.length !== challenge.positions.length) return false;

  return challenge.positions.every((position, index) => {
    const expected = words[position - 1];
    const given = (answers[index] ?? "").trim().toLowerCase();
    return !!expected && given === expected;
  });
}
