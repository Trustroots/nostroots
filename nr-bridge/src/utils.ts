/**
 * @module utils
 *
 * Cryptographic helpers for generating verification credentials.
 */

/**
 * Generate a cryptographically random six-digit numeric code.
 *
 * The returned string is always exactly six characters long and in the range
 * `100000`–`999999` (i.e. never starts with `0`).
 *
 * @returns A six-digit numeric string.
 */
export function generateSixDigitCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = (array[0] % 900000) + 100000;
  return code.toString();
}

/**
 * Generate a random UUID v4 token used as the KV lookup key for a pending
 * verification.
 *
 * @returns A UUID v4 string, e.g. `"550e8400-e29b-41d4-a716-446655440000"`.
 */
export function generateToken(): string {
  return crypto.randomUUID();
}
