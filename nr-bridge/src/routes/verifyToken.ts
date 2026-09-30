/**
 * @module verifyToken
 *
 * Hono route handler for `POST /verify_token`.
 *
 * Accepts a `{ username }` body, looks the user up in MongoDB, generates a
 * six-digit code and a UUID token, stores them in Deno KV with a 15-minute
 * TTL, and emails both the code and a deep link to the user. Requests are
 * throttled per user and across all users.
 */
import type { Context } from "hono";
import {
  TOKEN_EXPIRY_MS,
  type TokenRequest,
  VerifyTokenRequestSchema,
} from "../../schemas/tokenRequest.ts";
import { DEEP_LINK_BASE } from "../config.ts";
import { findUserByUsername } from "../db/mongodb.ts";
import {
  createTokenRequest,
  getTokenRequest,
  tryReserveGlobalVerifyTokenSlot,
  tryReserveVerifyTokenSlot,
} from "../db/kv.ts";
import { rateLimited } from "./rateLimited.ts";
import { generateSixDigitCode, generateToken } from "../utils.ts";
import { sendEmail } from "../email/send.ts";
import { buildVerificationEmail } from "../email/templates.ts";

/**
 * Handle `POST /verify_token`.
 *
 * @param c - Hono request context.
 * @returns `200` with `{ success: true }` on success, `400` for invalid input,
 *          `404` if the username is not in MongoDB, `409` if a verification
 *          is already pending, or `429` if the user or global throttle is
 *          used up.
 */
export async function handleVerifyToken(c: Context): Promise<Response> {
  const body = await c.req.json().catch(() => null);
  const parsed = VerifyTokenRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      400,
    );
  }

  const { username } = parsed.data;

  const user = await findUserByUsername(username);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const existing = await getTokenRequest(user.username);
  if (existing) {
    return c.json({ error: "Verification already pending" }, 409);
  }

  for (
    const [scope, reserve] of [
      ["user", () => tryReserveVerifyTokenSlot(user.id)],
      ["global", tryReserveGlobalVerifyTokenSlot],
    ] as const
  ) {
    const reservation = await reserve();
    if (!reservation.allowed) {
      console.warn(`verify_token ${scope} rate limit hit`, {
        userId: user.id,
        count: reservation.count,
      });
      return rateLimited(
        c,
        "Too many verification requests, try again later",
        reservation,
      );
    }
  }

  const now = Date.now();
  const code = generateSixDigitCode();
  const token = generateToken();

  const tokenRequest: TokenRequest = {
    id: crypto.randomUUID(),
    username: user.username,
    email: user.email,
    code,
    token,
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS,
  };

  await createTokenRequest(tokenRequest);

  const expiryMinutes = TOKEN_EXPIRY_MS / 60000;
  const deepLink = DEEP_LINK_BASE
    ? `${DEEP_LINK_BASE}?token=${encodeURIComponent(token)}`
    : undefined;

  const { subject, html } = buildVerificationEmail({
    code,
    expiryMinutes,
    deepLink,
  });

  await sendEmail({ to: user.email, subject, html });

  return c.json({ success: true });
}
