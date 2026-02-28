/**
 * @module send
 *
 * SMTP email delivery via denomailer. Configuration is read from environment
 * variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and
 * `SMTP_FROM`.
 */
import { SMTPClient } from "denomailer";

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

/**
 * Return the lazily-created SMTP client. Throws if the required `SMTP_HOST`,
 * `SMTP_USER`, or `SMTP_PASS` environment variables are missing.
 *
 * @returns A connected {@link SMTPClient}.
 */
function getSmtpClient(): SMTPClient {
  if (smtpClient) return smtpClient;

  const host = Deno.env.get("SMTP_HOST");
  const port = Number(Deno.env.get("SMTP_PORT") ?? "587");
  const username = Deno.env.get("SMTP_USER");
  const password = Deno.env.get("SMTP_PASS");

  if (!host || !username || !password) {
    throw new Error(
      "SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables are required",
    );
  }

  smtpClient = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls: port === 465,
      auth: {
        username,
        password,
      },
    },
  });

  return smtpClient;
}

/**
 * Send an email via the configured SMTP server.
 *
 * The sender address is read from `SMTP_FROM` (default
 * `noreply@nostroots.com`).
 *
 * @param options - Recipient, subject, and HTML body.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const from = Deno.env.get("SMTP_FROM") ?? "noreply@nostroots.com";
  const client = getSmtpClient();

  await client.send({
    from,
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
