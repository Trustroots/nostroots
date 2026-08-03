export type TrustrootsUsernameValidationResult =
  | {
      success: true;
      username: string;
      error: null;
    }
  | {
      success: false;
      username: null;
      error: string;
    };

export const TRUSTROOTS_NIP05_DOMAIN = "trustroots.org";

export function normalizeTrustrootsUsername(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * NIP-05 identifiers are matched case-insensitively, but Trustroots serves its
 * nostr.json keyed on the lowercase username, so the lookup must be lowercased.
 */
export function buildTrustrootsNip05Identifier(input: string): string {
  return `${normalizeTrustrootsUsername(input)}@${TRUSTROOTS_NIP05_DOMAIN}`;
}

export function validateTrustrootsUsername(
  input: string,
): TrustrootsUsernameValidationResult {
  const username = normalizeTrustrootsUsername(input);

  if (!username) {
    return {
      success: false,
      username: null,
      error: "Enter your Trustroots username.",
    };
  }

  if (username.includes("@")) {
    return {
      success: false,
      username: null,
      error: "Enter your Trustroots username, not your email address.",
    };
  }

  if (
    /\s/.test(username) ||
    username.includes("://") ||
    username.includes("/") ||
    username.includes("\\")
  ) {
    return {
      success: false,
      username: null,
      error: "Enter only your Trustroots username.",
    };
  }

  return {
    success: true,
    username,
    error: null,
  };
}
