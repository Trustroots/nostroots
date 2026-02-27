/**
 * @module authenticate
 *
 * Hono route handler for `POST /authenticate`.
 *
 * Accepts `{ username, npub, code?, token? }`, validates the six-digit code or
 * UUID token against the pending Deno KV entry, writes the npub into the
 * Trustroots MongoDB `users` collection, and removes the KV entry on success.
 */
import type { Context } from "hono";
import { AuthenticateRequestSchema } from "../../schemas/tokenRequest.ts";
import { getTokenRequest, deleteTokenRequest } from "../db/kv.ts";
import { setNpubForUsername } from "../db/mongodb.ts";

/**
 * Handle `POST /authenticate`.
 *
 * @param c - Hono request context.
 * @returns `200` with `{ success: true }` when the npub is successfully set,
 *          `400` for invalid input, `401` if the code/token is wrong or
 *          expired, or `500` if the MongoDB update fails.
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

  const { username, npub, code, token } = parsed.data;

  const tokenRequest = await getTokenRequest(username);
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
