/**
 * @module supportRequest
 *
 * Request schema for `POST /support`.
 */
import { z } from "zod";

/**
 * Upper bound on the message body. Generous enough for a pasted debug block
 * plus a description of the problem, small enough that the endpoint cannot be
 * used to push large payloads through our SMTP relay.
 */
export const SUPPORT_MESSAGE_MAX_LENGTH = 8000;

/** Body accepted by `POST /support`. */
export const SupportRequestSchema = z.object({
  message: z.string().trim().min(1).max(SUPPORT_MESSAGE_MAX_LENGTH),
});

/** Parsed `POST /support` body. */
export type SupportRequest = z.infer<typeof SupportRequestSchema>;
