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

export { PendingVerificationSchema, TOKEN_EXPIRY_MS };

/** A pending verification record stored in Deno KV. */
export type PendingVerification = z.infer<typeof PendingVerificationSchema>;
