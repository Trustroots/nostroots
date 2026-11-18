/**
 * @module tokenRequest
 *
 * Zod schemas and TypeScript types for the token-request verification flow.
 *
 * - {@link TokenRequestSchema} — shape of a token request stored in Deno KV.
 * - {@link VerifyTokenRequestSchema} — expected body of `POST /verify_token`.
 * - {@link AuthenticateRequestSchema} — expected body of `POST /authenticate`.
 * - {@link TOKEN_EXPIRY_MS} — how long a token request remains valid (15 min).
 * - {@link MAX_VERIFY_ATTEMPTS} — code/token submissions accepted per token
 *   request before it is deleted.
 * - {@link MAX_VERIFY_TOKEN_PER_WINDOW} / {@link VERIFY_TOKEN_WINDOW_MS} —
 *   per-user `POST /verify_token` throttle.
 * - {@link MAX_VERIFY_TOKEN_GLOBAL_PER_WINDOW} /
 *   {@link MAX_VERIFY_ATTEMPTS_GLOBAL_PER_WINDOW} — caps across all users.
 */
import { z } from "zod";

/** Duration in milliseconds before a token request expires (15 minutes). */
const TOKEN_EXPIRY_MS = 15 * 60 * 1000;

/**
 * Code/token submissions accepted against one token request before it is
 * deleted. Together with {@link MAX_VERIFY_TOKEN_PER_WINDOW} this caps an
 * attacker at 15 guesses per user per hour against a 10⁶ code space.
 */
const MAX_VERIFY_ATTEMPTS = 5;

/** Window length for all rate limits (1 hour). */
const VERIFY_TOKEN_WINDOW_MS = 60 * 60 * 1000;

/**
 * `POST /verify_token` calls accepted per user per
 * {@link VERIFY_TOKEN_WINDOW_MS}. Going below 3 risks blocking legitimate
 * retries after transient SMTP failures.
 */
const MAX_VERIFY_TOKEN_PER_WINDOW = 3;

/**
 * Verification emails sent per {@link VERIFY_TOKEN_WINDOW_MS} across all
 * users, so spreading requests over many usernames can't turn nr-bridge into
 * a mail cannon.
 */
const MAX_VERIFY_TOKEN_GLOBAL_PER_WINDOW = 300;

/**
 * Six-digit code comparisons per {@link VERIFY_TOKEN_WINDOW_MS} across all
 * users.
 * The per-user limits don't bound an attacker guessing across many usernames;
 * this does: at most 300 guesses an hour against a 10⁶ code space.
 */
const MAX_VERIFY_ATTEMPTS_GLOBAL_PER_WINDOW = 300;

/**
 * Schema for a token request persisted in Deno KV.
 *
 * Each request is keyed by `["tokenRequests", username]` and contains both a
 * six-digit verification code (for manual entry) and a UUID token (for deep
 * links). `attempts` counts code/token submissions against it.
 */
const TokenRequestSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1),
  email: z.string().email(),
  token: z.string().uuid().optional(),
  code: z
    .string()
    .regex(/^\d{6}$/, "Code must be exactly 6 digits")
    .optional(),
  createdAt: z.number(),
  expiresAt: z.number(),
  attempts: z.number().int().nonnegative().optional(),
});

/** Schema for the `POST /verify_token` request body. */
const VerifyTokenRequestSchema = z.object({
  username: z.string().min(1),
});

/**
 * Schema for the `POST /authenticate` request body.
 *
 * Requires either `code` (six-digit string) or `token` (UUID) — at least one
 * must be present. The `npub` field must start with `"npub"`.
 */
const AuthenticateRequestSchema = z
  .object({
    username: z.string().min(1),
    npub: z.string().refine(
      (val) => val.toLowerCase().startsWith("npub"),
      { message: 'Must be a nostr npub (starts with "npub")' },
    ),
    code: z
      .string()
      .regex(/^\d{6}$/, "Code must be exactly 6 digits")
      .optional(),
    token: z.string().uuid().optional(),
  })
  .refine((data) => data.code || data.token, {
    message: "Either code or token must be provided",
  });

export {
  AuthenticateRequestSchema,
  MAX_VERIFY_ATTEMPTS,
  MAX_VERIFY_ATTEMPTS_GLOBAL_PER_WINDOW,
  MAX_VERIFY_TOKEN_GLOBAL_PER_WINDOW,
  MAX_VERIFY_TOKEN_PER_WINDOW,
  TOKEN_EXPIRY_MS,
  TokenRequestSchema,
  VERIFY_TOKEN_WINDOW_MS,
  VerifyTokenRequestSchema,
};

/** A token request record stored in Deno KV. */
export type TokenRequest = z.infer<typeof TokenRequestSchema>;

/** Parsed body of a `POST /verify_token` request. */
export type VerifyTokenRequest = z.infer<typeof VerifyTokenRequestSchema>;

/** Parsed body of a `POST /authenticate` request. */
export type AuthenticateRequest = z.infer<typeof AuthenticateRequestSchema>;
