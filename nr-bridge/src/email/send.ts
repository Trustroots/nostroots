/**
 * @module send
 *
 * SMTP email delivery via upyo. Configuration is read from config.ts.
 */
import { createMessage } from "@upyo/core";
import { SmtpTransport } from "@upyo/smtp";
import {
  SMTP_FROM,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_USER,
} from "../config.ts";

/** Options accepted by {@link sendEmail}. */
export interface EmailOptions {
  /** Recipient email address. */
  to: string;
  /** Email subject line. */
  subject: string;
  /** Full HTML body. */
  html: string;
}

let transport: SmtpTransport | null = null;

function getTransport(): SmtpTransport {
  if (transport) return transport;

  if ((SMTP_USER && !SMTP_PASS) || (!SMTP_USER && SMTP_PASS)) {
    throw new Error("SMTP_USER and SMTP_PASS must be provided together");
  }

  transport = new SmtpTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    ...(SMTP_USER && SMTP_PASS
      ? { auth: { user: SMTP_USER, pass: SMTP_PASS } }
      : {}),
  });

  return transport;
}

/**
 * Send an email via the configured SMTP server.
 *
 * @param options - Recipient, subject, and HTML body.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const message = createMessage({
    from: SMTP_FROM,
    to: options.to,
    subject: options.subject,
    content: { html: options.html },
  });
  await getTransport().send(message);
}

/**
 * Close all pooled SMTP connections and reset internal state. Safe to call
 * even if no transport has been created.
 */
export async function closeSmtpClient(): Promise<void> {
  if (transport) {
    await transport.closeAllConnections();
    transport = null;
  }
}
