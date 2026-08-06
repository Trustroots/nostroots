/**
 * @module support
 *
 * Hono route handler for `POST /support`.
 *
 * Accepts a `{ message }` body authenticated with a NIP-98 HTTP Auth event and
 * emails it to Trustroots support. The signature is the only gate: an
 * unsigned request is rejected, so there is no anonymous path into our SMTP
 * relay.
 */
import { SupportRequestSchema } from "@trustroots/nr-common";
import type { Context } from "hono";
import { nip19 } from "nostr-tools";
import { SUPPORT_EMAIL } from "../config.ts";
import { findUserByNpub, getUsersCollection } from "../db/mongodb.ts";
import { sendEmail } from "../email/send.ts";
import { buildSupportEmail } from "../email/templates.ts";
import { verifyNip98Header } from "../nostr/nip98.ts";

/**
 * Handle `POST /support`.
 *
 * @param c - Hono request context.
 * @returns `200` with `{ success: true }` on success, `400` for an invalid or
 *          oversized body, or `401` when the NIP-98 signature is missing or
 *          does not match the request.
 */
export async function handleSupport(c: Context): Promise<Response> {
  const body = await c.req.json().catch(() => null);
  const parsed = SupportRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      400,
    );
  }

  const auth = await verifyNip98Header(
    c.req.header("Authorization"),
    "/support",
    "POST",
    body as Record<string, unknown>,
  );

  if (!auth.ok) {
    return c.json({ error: auth.reason }, 401);
  }

  const npub = nip19.npubEncode(auth.pubkey);
  const users = await getUsersCollection();
  const user = await findUserByNpub(users, npub);

  const { subject, html } = buildSupportEmail({
    message: parsed.data.message,
    npub,
    username: user?.username,
  });

  await sendEmail({ to: SUPPORT_EMAIL, subject, html });

  return c.json({ success: true });
}
