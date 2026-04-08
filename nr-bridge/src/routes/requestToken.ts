/**
 * @module requestToken
 *
 * Hono route handler for `POST /request_token`.
 *
 * Accepts a `{ username }` body, looks the user up in MongoDB, generates a
 * UUID token (returned to the API client) and a six-digit code (emailed to
 * the user), stores both in Deno KV with a 15-minute TTL, and returns the
 * token in the response body so the client can supply it back later via
 * `POST /verify_code`.
 *
 * When the username does not match any user, the handler returns a
 * throw-away token with no side effects. This keeps the response
 * indistinguishable from a real flow and prevents username (and, in the
 * future, email) enumeration.
 */
import type { Context } from "hono";
import { RequestTokenBodySchema } from "@trustroots/nr-common";
import {
  type PendingVerification,
  TOKEN_EXPIRY_MS,
} from "../../schemas/pendingVerification.ts";
import { findUserByUsername } from "../db/mongodb.ts";
import { createPendingVerification } from "../db/kv.ts";
import { generateSixDigitCode, generateToken } from "../utils.ts";
import { sendEmail } from "../email/send.ts";
import { buildVerificationEmail } from "../email/templates.ts";

/**
 * Handle `POST /request_token`.
 *
 * @param context - Hono request context.
 * @returns `200` with `{ token }` for any well-formed request (whether or
 *          not the username exists), or `400` for invalid input.
 */
export async function handleRequestToken(
  context: Context,
): Promise<Response> {
  const body = await context.req.json().catch(() => null);
  const parsed = RequestTokenBodySchema.safeParse(body);

  if (!parsed.success) {
    return context.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      400,
    );
  }

  const { username } = parsed.data;

  const user = await findUserByUsername(username);
  if (!user) {
    // Silently succeed to prevent username enumeration: the response is
    // indistinguishable from a real flow, but step 2 will fail with the
    // same generic 401 as an expired token.
    return context.json({ token: generateToken() });
  }

  const now = Date.now();
  const token = generateToken();
  const code = generateSixDigitCode();

  const verification: PendingVerification = {
    id: crypto.randomUUID(),
    username: user.username,
    email: user.email,
    token,
    code,
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS,
  };

  await createPendingVerification(verification);

  const expiryMinutes = TOKEN_EXPIRY_MS / 60000;

  const { subject, html } = buildVerificationEmail({ code, expiryMinutes });
  await sendEmail({ to: user.email, subject, html });

  return context.json({ token });
}
