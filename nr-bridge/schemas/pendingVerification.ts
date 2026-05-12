/**
 * @module pendingVerification
 *
 * Internal Zod schema and TypeScript types for the email-verification flow's
 * KV storage. HTTP request body schemas live in `@trustroots/nr-common` so
 * they can be shared with `nr-app`.
 *
 * - {@link PendingVerificationSchema} — shape of the record stored in Deno KV
 *   while a verification is in progress (keyed by token).
 * - {@link TOKEN_EXPIRY_MS} — how long a pending verification remains valid
 *   (15 minutes).
 * - {@link MAX_VERIFY_ATTEMPTS} — per-token wrong-code lockout threshold.
 * - {@link MAX_REQUEST_TOKEN_PER_WINDOW} / {@link REQUEST_TOKEN_WINDOW_MS} —
 *   per-user (and per-input-string) request_token throttle.
 */
import { z } from "zod";

/** Duration in milliseconds before a pending verification expires (15 min). */
const TOKEN_EXPIRY_MS = 15 * 60 * 1000;

/**
 * Maximum number of wrong code submissions tolerated against a single
 * pending verification before the record is deleted ("lockout").
 *
 * Threat math: with {@link MAX_REQUEST_TOKEN_PER_WINDOW} = 3 and
 * MAX_VERIFY_ATTEMPTS = 5, an attacker holding a real user's identifier can
 * obtain at most 3 valid tokens per hour and 5 guesses per token, i.e. ≤ 15
 * guesses per user per hour against a 10⁶ code space (≈ 1.7×10⁻⁵ probability
 * of success per hour). Tightening this below ~3 risks locking out legitimate
 * users who fat-finger the code; the current value is a deliberate trade-off.
 */
const MAX_VERIFY_ATTEMPTS = 5;

/** Sliding-window length for the request_token throttle (1 hour). */
const REQUEST_TOKEN_WINDOW_MS = 60 * 60 * 1000;

/**
 * Maximum number of `/request_token` calls accepted per
 * {@link REQUEST_TOKEN_WINDOW_MS} window for a given user. Tightening below 3
 * risks blocking legitimate retries after transient SMTP failures.
 */
const MAX_REQUEST_TOKEN_PER_WINDOW = 3;

/**
 * Schema for a pending email verification persisted in Deno KV.
 *
 * Each record is keyed by `[KV_KEYS.pendingVerifications, token]`. The token
 * is returned to the API client by `POST /request_token`; the code is sent to
 * the user via email. Both must be presented to `POST /verify_code` to
 * complete the verification.
 *
 * `attempts` counts wrong-code submissions against this token; when it
 * reaches {@link MAX_VERIFY_ATTEMPTS} the record is deleted by the verify
 * route. The `.default(0)` keeps any in-flight records written before this
 * field existed parseable across a deploy boundary.
 */
const PendingVerificationSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1),
  email: z.string().email(),
  token: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Code must be exactly 6 digits"),
  createdAt: z.number(),
  expiresAt: z.number(),
  attempts: z.number().int().nonnegative().default(0),
});

export {
  MAX_REQUEST_TOKEN_PER_WINDOW,
  MAX_VERIFY_ATTEMPTS,
  PendingVerificationSchema,
  REQUEST_TOKEN_WINDOW_MS,
  TOKEN_EXPIRY_MS,
};

/** A pending verification record stored in Deno KV. */
export type PendingVerification = z.infer<typeof PendingVerificationSchema>;
