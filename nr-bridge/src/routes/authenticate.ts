/**
 * @module authenticate
 *
 * Hono route handler for `POST /authenticate`.
 *
 * Accepts `{ username, npub, code?, token? }`, validates the six-digit code or
 * UUID token against the pending Deno KV entry, writes the npub into the
 * Trustroots MongoDB `users` collection, and removes the KV entry on success.
 * Every submission counts towards a per-request lockout and a cap on
 * comparisons across all users.
 */
import type { Context } from "hono";
import { AuthenticateRequestSchema } from "../../schemas/tokenRequest.ts";
import {
  deleteTokenRequest,
  reserveVerifyAttempt,
  tryReserveGlobalVerifyAttemptSlot,
} from "../db/kv.ts";
import { rateLimited } from "./rateLimited.ts";
import { setNpubForUsername } from "../db/mongodb.ts";

/**
 * Handle `POST /authenticate`.
 *
 * @param c - Hono request context.
 * @returns `200` with `{ success: true }` when the npub is successfully set,
 *          `400` for invalid input, `401` if the code/token is wrong or
 *          expired, `429` if the global code-guess cap is used up, or `500`
 *          if the MongoDB update fails.
 */
export async function handleAuthenticate(c: Context): Promise<Response> {
  const body = await c.req.json().catch(() => null);
  const parsed = AuthenticateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      400,
    );
  }

  const { npub, code, token } = parsed.data;
  const username = parsed.data.username.toLowerCase();

  // Only six-digit codes are guessable, so deep-link tokens skip the global
  // cap and keep working while it's exhausted. The cap is checked before the
  // per-request attempt is consumed, so a 429 never costs a legitimate user
  // one of their attempts.
  if (code) {
    const globalAttempt = await tryReserveGlobalVerifyAttemptSlot();
    if (!globalAttempt.allowed) {
      console.warn("authenticate global rate limit hit", {
        count: globalAttempt.count,
      });
      return rateLimited(
        c,
        "Too many verification attempts, try again later",
        globalAttempt,
      );
    }
  }

  const tokenRequest = await reserveVerifyAttempt(username);
  if (!tokenRequest) {
    return c.json({ error: "No pending verification or code expired" }, 401);
  }

  const codeMatch = code && tokenRequest.code === code;
  const tokenMatch = token && tokenRequest.token === token;

  if (!codeMatch && !tokenMatch) {
    return c.json({ error: "Invalid code or token" }, 401);
  }

  const updated = await setNpubForUsername(username, npub);
  if (!updated) {
    return c.json({ error: "Failed to update user" }, 500);
  }

  await deleteTokenRequest(username);

  return c.json({ success: true });
}
