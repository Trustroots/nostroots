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
 *
 * Both branches are independently rate-limited via the request_token throttle
 * (real users by Mongo `_id`, unknown inputs by lowercased input string).
 * Throttling the unknown branch is the second leg of the enumeration defence
 * — without it, the throttle on the real branch would itself become an
 * enumeration oracle. The 429 response is byte-identical between the two
 * branches by construction (single `respondRateLimited` builder).
 */
import type { Context } from "hono";
import { RequestTokenBodySchema } from "@trustroots/nr-common";
import {
  type PendingVerification,
  REQUEST_TOKEN_WINDOW_MS,
  TOKEN_EXPIRY_MS,
} from "../../schemas/pendingVerification.ts";
import { findUserByUsername } from "../db/mongodb.ts";
import {
  createPendingVerification,
  tryReserveRequestTokenSlotByInput,
  tryReserveRequestTokenSlotByUserId,
} from "../db/kv.ts";
import { generateSixDigitCode, generateToken } from "../utils.ts";
import { sendEmail } from "../email/send.ts";
import { buildVerificationEmail } from "../email/templates.ts";

/**
 * Build the 429 response used by both branches of the throttle. Defined in
 * one place so a future maintainer cannot accidentally diverge the body or
 * headers between branches and re-open the enumeration oracle.
 */
function respondRateLimited(context: Context): Response {
  return context.json(
    { error: "Too many verification requests, try again later" },
    429,
    { "Retry-After": String(Math.ceil(REQUEST_TOKEN_WINDOW_MS / 1000)) },
  );
}

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
    // Unknown-user (throwaway) branch. Silently succeed to prevent
    // enumeration. The throttle here is the second leg of that enumeration
    // defence: without it, hitting the real-branch throttle would itself
    // be a signal that the user exists.
    const normalizedInput = username.toLowerCase();
    const reservation = await tryReserveRequestTokenSlotByInput(
      normalizedInput,
    );
    if (!reservation.allowed) {
      console.warn("request_token rate limit hit (input)", {
        input: normalizedInput,
        count: reservation.count,
      });
      return respondRateLimited(context);
    }
    return context.json({ token: generateToken() });
  }

  // Real-user branch. Throttle on the canonical Mongo _id so that future
  // email-based lookups hit the same counter.
  const reservation = await tryReserveRequestTokenSlotByUserId(user.id);
  if (!reservation.allowed) {
    console.warn("request_token rate limit hit (uid)", {
      userId: user.id,
      count: reservation.count,
    });
    return respondRateLimited(context);
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
    attempts: 0,
  };

  await createPendingVerification(verification);

  const expiryMinutes = TOKEN_EXPIRY_MS / 60000;

  const { subject, html } = buildVerificationEmail({ code, expiryMinutes });
  await sendEmail({ to: user.email, subject, html });

  return context.json({ token });
}
