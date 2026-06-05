/**
 * @module verifyToken
 *
 * Hono route handler for `POST /verify_token`.
 *
 * Accepts a `{ username }` body, looks the user up in MongoDB, generates a
 * six-digit code and a UUID token, stores them in Deno KV with a 15-minute
 * TTL, and emails both the code and a deep link to the user.
 */
import type { Context } from "hono";
import { VerifyTokenRequestSchema } from "../../schemas/tokenRequest.ts";
import { TOKEN_EXPIRY_MS } from "../../schemas/tokenRequest.ts";
import type { TokenRequest } from "../../schemas/tokenRequest.ts";
import { findUserByUsername } from "../db/mongodb.ts";
import { getTokenRequest, createTokenRequest } from "../db/kv.ts";
import { generateSixDigitCode, generateToken } from "../utils.ts";
import { sendEmail } from "../email/send.ts";
import { buildVerificationEmail } from "../email/templates.ts";

/**
 * Handle `POST /verify_token`.
 *
 * @param c - Hono request context.
 * @returns `200` with `{ success: true }` on success, `400` for invalid input,
 *          `404` if the username is not in MongoDB, or `409` if a verification
 *          is already pending.
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

  const existing = await getTokenRequest(username);
  if (existing) {
    return c.json({ error: "Verification already pending" }, 409);
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

  const deepLinkBase =
    Deno.env.get("DEEP_LINK_BASE") ?? "nostroots://verify";
  const expiryMinutes = TOKEN_EXPIRY_MS / 60000;

  const { subject, html } = buildVerificationEmail({
    code,
    token,
    deepLinkBase,
    expiryMinutes,
  });

  await sendEmail({ to: user.email, subject, html });

  return c.json({ success: true });
}
