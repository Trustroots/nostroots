/**
 * @module verifyCode
 *
 * Hono route handler for `POST /verify_code`.
 *
 * Accepts `{ token, code, npub }`, looks up the matching pending verification
 * by token, checks the supplied code matches, writes the npub into the
 * Trustroots MongoDB `users` collection, and removes the KV entry on success.
 */
import type { Context } from "hono";
import { VerifyCodeBodySchema } from "@trustroots/nr-common";
import {
  deletePendingVerification,
  getPendingVerification,
  incrementVerifyAttempts,
} from "../db/kv.ts";
import { setNpubForUsername } from "../db/mongodb.ts";

/**
 * Handle `POST /verify_code`.
 *
 * @param context - Hono request context.
 * @returns `200` with `{ success: true }` when the npub is successfully set,
 *          `400` for invalid input, `401` if the token is unknown/expired or
 *          the code does not match, or `500` if the MongoDB update fails.
 */
export async function handleVerifyCode(
  context: Context,
): Promise<Response> {
  const body = await context.req.json().catch(() => null);
  const parsed = VerifyCodeBodySchema.safeParse(body);

  if (!parsed.success) {
    return context.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      400,
    );
  }

  const { token, code, npub } = parsed.data;

  const verification = await getPendingVerification(token);
  if (!verification) {
    return context.json(
      { error: "No pending verification or token expired" },
      401,
    );
  }

  if (verification.code !== code) {
    // Count this wrong attempt against the per-token lockout. The response
    // shape stays "Invalid code" even on the lockout-triggering call — the
    // attacker only discovers the lockout on their *next* call, which falls
    // through to the existing "No pending verification or token expired"
    // branch above and is indistinguishable from a naturally expired token.
    await incrementVerifyAttempts(token);
    return context.json({ error: "Invalid code" }, 401);
  }

  const updated = await setNpubForUsername(verification.username, npub);
  if (!updated) {
    return context.json({ error: "Failed to update user" }, 500);
  }

  await deletePendingVerification(token);

  return context.json({ success: true });
}
