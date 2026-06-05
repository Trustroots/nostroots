/**
 * @module tokenRequest
 *
 * Zod schemas and TypeScript types for the token-request verification flow.
 *
 * - {@link TokenRequestSchema} — shape of a token request stored in Deno KV.
 * - {@link VerifyTokenRequestSchema} — expected body of `POST /verify_token`.
 * - {@link AuthenticateRequestSchema} — expected body of `POST /authenticate`.
 * - {@link TOKEN_EXPIRY_MS} — how long a token request remains valid (15 min).
 */
import { z } from "zod";

/** Duration in milliseconds before a token request expires (15 minutes). */
const TOKEN_EXPIRY_MS = 15 * 60 * 1000;

/**
 * Schema for a token request persisted in Deno KV.
 *
 * Each request is keyed by `["tokenRequests", username]` and contains both a
 * six-digit verification code (for manual entry) and a UUID token (for deep
 * links).
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
  TokenRequestSchema,
  VerifyTokenRequestSchema,
  AuthenticateRequestSchema,
  TOKEN_EXPIRY_MS,
};

/** A token request record stored in Deno KV. */
export type TokenRequest = z.infer<typeof TokenRequestSchema>;

/** Parsed body of a `POST /verify_token` request. */
export type VerifyTokenRequest = z.infer<typeof VerifyTokenRequestSchema>;

/** Parsed body of a `POST /authenticate` request. */
export type AuthenticateRequest = z.infer<typeof AuthenticateRequestSchema>;
