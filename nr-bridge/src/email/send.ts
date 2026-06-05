/**
 * @module send
 *
 * SMTP email delivery via denomailer. Configuration is read from config.ts.
 */
import { SMTPClient } from "denomailer";
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

let smtpClient: SMTPClient | null = null;

function getSmtpClient(): SMTPClient {
  if (smtpClient) return smtpClient;

  if ((SMTP_USER && !SMTP_PASS) || (!SMTP_USER && SMTP_PASS)) {
    throw new Error("SMTP_USER and SMTP_PASS must be provided together");
  }

  smtpClient = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: SMTP_PORT === 465,
      ...(SMTP_USER && SMTP_PASS
        ? { auth: { username: SMTP_USER, password: SMTP_PASS } }
        : {}),
    },

  });

  return smtpClient;
}

/**
 * Send an email via the configured SMTP server.
 *
 * @param options - Recipient, subject, and HTML body.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const client = getSmtpClient();

  await client.send({
    from: SMTP_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}

/**
 * Close the shared SMTP client and reset internal state. Safe to call even if
 * no client has been created.
 */
export async function closeSmtpClient(): Promise<void> {
  if (smtpClient) {
    await smtpClient.close();
    smtpClient = null;
  }
}
