import { z } from "../deps.ts";

/** Schema for the `POST /request_token` request body. */
export const RequestTokenBodySchema = z.object({
  username: z.string().min(1),
});

/**
 * Schema for the `POST /verify_code` request body.
 *
 * The client must supply the `token` it received from `POST /request_token`,
 * the six-digit `code` the user typed in from their email, and the user's
 * Nostr `npub`.
 */
export const VerifyCodeBodySchema = z.object({
  token: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Code must be exactly 6 digits"),
  npub: z.string().refine(
    (val) => val.toLowerCase().startsWith("npub"),
    { message: 'Must be a nostr npub (starts with "npub")' },
  ),
});

/**
 * Upper bound on the `POST /support` message body. Accommodates a typical debug
 * block (~400 chars) plus user-typed context, small enough to prevent abuse of
 * the SMTP relay.
 */
export const SUPPORT_MESSAGE_MAX_LENGTH = 2000;

/** Schema for the `POST /support` request body. */
export const SupportRequestSchema = z.object({
  message: z.string().trim().min(1).max(SUPPORT_MESSAGE_MAX_LENGTH),
});

/** Parsed body of a `POST /request_token` request. */
export type RequestTokenBody = z.infer<typeof RequestTokenBodySchema>;

/** Parsed body of a `POST /verify_code` request. */
export type VerifyCodeBody = z.infer<typeof VerifyCodeBodySchema>;

/** Parsed body of a `POST /support` request. */
export type SupportRequest = z.infer<typeof SupportRequestSchema>;
