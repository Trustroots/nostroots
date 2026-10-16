import {
  checkBackupChallenge,
  createBackupChallenge,
  isMnemonicSecret,
} from "./backupChallenge.utils";

const MNEMONIC =
  "abandon ability able about above absent absorb abstract absurd abuse access accident";
const NSEC = "nsec1exampleexampleexampleexampleexampleexampleexampleexample";

describe("isMnemonicSecret", () => {
  it("recognises supported mnemonic lengths", () => {
    expect(isMnemonicSecret(MNEMONIC)).toBe(true);
    expect(isMnemonicSecret(`  ${MNEMONIC}  `)).toBe(true);
  });

  it("rejects an nsec and other word counts", () => {
    expect(isMnemonicSecret(NSEC)).toBe(false);
    expect(isMnemonicSecret("one two three")).toBe(false);
    expect(isMnemonicSecret("")).toBe(false);
  });
});

describe("createBackupChallenge", () => {
  it("asks for three distinct, ascending, in-range positions", () => {
    const challenge = createBackupChallenge(MNEMONIC);

    expect(challenge.type).toBe("mnemonic");
    if (challenge.type !== "mnemonic") throw new Error("unreachable");

    expect(challenge.positions).toHaveLength(3);
    expect(new Set(challenge.positions).size).toBe(3);
    expect([...challenge.positions].sort((a, b) => a - b)).toEqual(
      challenge.positions,
    );
    challenge.positions.forEach((position) => {
      expect(position).toBeGreaterThanOrEqual(1);
      expect(position).toBeLessThanOrEqual(12);
    });
  });

  it("uses the injected random source", () => {
    expect(createBackupChallenge(MNEMONIC, () => 0)).toEqual({
      type: "mnemonic",
      positions: [1, 2, 3],
    });

    expect(createBackupChallenge(MNEMONIC, () => 0.999)).toEqual({
      type: "mnemonic",
      positions: [10, 11, 12],
    });
  });

  it("falls back to a full-secret challenge for an nsec", () => {
    expect(createBackupChallenge(NSEC)).toEqual({ type: "secret" });
  });
});

describe("checkBackupChallenge", () => {
  const challenge = { type: "mnemonic" as const, positions: [1, 7, 12] };

  it("accepts the right words", () => {
    expect(
      checkBackupChallenge(challenge, MNEMONIC, [
        "abandon",
        "absorb",
        "accident",
      ]),
    ).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(
      checkBackupChallenge(challenge, MNEMONIC, [
        " Abandon ",
        "ABSORB",
        "accident",
      ]),
    ).toBe(true);
  });

  it("rejects a wrong word", () => {
    expect(
      checkBackupChallenge(challenge, MNEMONIC, ["abandon", "absorb", "abuse"]),
    ).toBe(false);
  });

  it("rejects blank or missing answers", () => {
    expect(
      checkBackupChallenge(challenge, MNEMONIC, ["abandon", "absorb"]),
    ).toBe(false);
    expect(
      checkBackupChallenge(challenge, MNEMONIC, ["abandon", "absorb", "  "]),
    ).toBe(false);
  });

  it("rejects pasting the whole mnemonic into one field", () => {
    expect(
      checkBackupChallenge(challenge, MNEMONIC, [MNEMONIC, MNEMONIC, MNEMONIC]),
    ).toBe(false);
  });

  it("compares the full secret for the nsec fallback", () => {
    const secretChallenge = { type: "secret" as const };
    expect(checkBackupChallenge(secretChallenge, NSEC, [NSEC])).toBe(true);
    expect(checkBackupChallenge(secretChallenge, NSEC, [` ${NSEC} `])).toBe(
      true,
    );
    expect(checkBackupChallenge(secretChallenge, NSEC, ["nsec1nope"])).toBe(
      false,
    );
    expect(checkBackupChallenge(secretChallenge, "", [""])).toBe(false);
  });
});
