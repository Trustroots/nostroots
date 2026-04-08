/**
 * @module pendingVerification
 *
 * Zod schemas and TypeScript types for the email-verification flow.
 *
 * - {@link PendingVerificationSchema} — shape of the record stored in Deno KV
 *   while a verification is in progress (keyed by token).
 * - {@link RequestTokenBodySchema} — body of `POST /request_token`.
 * - {@link VerifyCodeBodySchema} — body of `POST /verify_code`.
 * - {@link TOKEN_EXPIRY_MS} — how long a pending verification remains valid
 *   (15 minutes).
 */
import { z } from "zod";

/** Duration in milliseconds before a pending verification expires (15 min). */
const TOKEN_EXPIRY_MS = 15 * 60 * 1000;

/**
 * Schema for a pending email verification persisted in Deno KV.
 *
 * Each record is keyed by `[KV_KEYS.pendingVerifications, token]`. The token
 * is returned to the API client by `POST /request_token`; the code is sent to
 * the user via email. Both must be presented to `POST /verify_code` to
 * complete the verification.
 */
const PendingVerificationSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1),
  email: z.string().email(),
  token: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Code must be exactly 6 digits"),
  createdAt: z.number(),
  expiresAt: z.number(),
});

/** Schema for the `POST /request_token` request body. */
const RequestTokenBodySchema = z.object({
  username: z.string().min(1),
});

/**
 * Schema for the `POST /verify_code` request body.
 *
 * The client must supply the `token` it received from `POST /request_token`,
 * the six-digit `code` the user typed in from their email, and the user's
 * Nostr `npub`.
 */
const VerifyCodeBodySchema = z.object({
  token: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Code must be exactly 6 digits"),
  npub: z.string().refine(
    (val) => val.toLowerCase().startsWith("npub"),
    { message: 'Must be a nostr npub (starts with "npub")' },
  ),
});

export {
  PendingVerificationSchema,
  RequestTokenBodySchema,
  TOKEN_EXPIRY_MS,
  VerifyCodeBodySchema,
};

/** A pending verification record stored in Deno KV. */
export type PendingVerification = z.infer<typeof PendingVerificationSchema>;

/** Parsed body of a `POST /request_token` request. */
export type RequestTokenBody = z.infer<typeof RequestTokenBodySchema>;

/** Parsed body of a `POST /verify_code` request. */
export type VerifyCodeBody = z.infer<typeof VerifyCodeBodySchema>;
