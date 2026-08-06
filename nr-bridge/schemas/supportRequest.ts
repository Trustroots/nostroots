/**
 * @module supportRequest
 *
 * Request schema for `POST /support`.
 */
import { z } from "zod";

/**
 * Upper bound on the message body. Accommodates a typical debug block (~400 chars)
 * plus user-typed context, small enough to prevent abuse of the SMTP relay.
 */
export const SUPPORT_MESSAGE_MAX_LENGTH = 2000;

/** Body accepted by `POST /support`. */
export const SupportRequestSchema = z.object({
  message: z.string().trim().min(1).max(SUPPORT_MESSAGE_MAX_LENGTH),
});

/** Parsed `POST /support` body. */
export type SupportRequest = z.infer<typeof SupportRequestSchema>;
