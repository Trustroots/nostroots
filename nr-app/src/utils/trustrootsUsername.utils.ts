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

/**
 * Users reach for whatever identifier they have to hand, so accept the three
 * shapes that can be resolved to a username without a lookup: `alice`,
 * `@alice` and `alice@trustroots.org`. An arbitrary email cannot be mapped to
 * a username without an email->username endpoint Trustroots does not expose,
 * so it is reported rather than guessed at.
 */
function extractUsername(
  normalized: string,
): TrustrootsUsernameValidationResult {
  const withoutHandlePrefix = normalized.startsWith("@")
    ? normalized.slice(1)
    : normalized;

  const atCount = (withoutHandlePrefix.match(/@/g) ?? []).length;

  if (atCount > 1) {
    return {
      success: false,
      username: null,
      error: "Enter only your Trustroots username.",
    };
  }

  if (atCount === 1) {
    const [localPart, domain] = withoutHandlePrefix.split("@");

    if (domain !== TRUSTROOTS_NIP05_DOMAIN) {
      return {
        success: false,
        username: null,
        error:
          "That looks like an email address. Enter your Trustroots username instead — you can find it on your Trustroots profile.",
      };
    }

    return { success: true, username: localPart, error: null };
  }

  return { success: true, username: withoutHandlePrefix, error: null };
}

export function validateTrustrootsUsername(
  input: string,
): TrustrootsUsernameValidationResult {
  const normalized = normalizeTrustrootsUsername(input);

  if (!normalized) {
    return {
      success: false,
      username: null,
      error: "Enter your Trustroots username.",
    };
  }

  const extracted = extractUsername(normalized);

  if (!extracted.success) {
    return extracted;
  }

  const username = extracted.username;

  if (!username) {
    return {
      success: false,
      username: null,
      error: "Enter your Trustroots username.",
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
