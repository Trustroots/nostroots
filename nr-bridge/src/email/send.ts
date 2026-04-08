/**
 * @module send
 *
 * SMTP email delivery via denomailer. A fresh {@link SMTPClient} is opened
 * for each send and closed afterwards — denomailer connects eagerly on
 * construction, so we cannot keep one around at module scope without forcing
 * a connection at import time (which would break unit tests).
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

/**
 * Send an email via the configured SMTP server.
 *
 * @param options - Recipient, subject, and HTML body.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "SMTP_HOST, SMTP_USER, and SMTP_PASS must be set to send mail",
    );
  }

  const client = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: SMTP_PORT === 465,
      auth: {
        username: SMTP_USER,
        password: SMTP_PASS,
      },
    },
  });

  try {
    await client.send({
      from: SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  } finally {
    await client.close();
  }
}
