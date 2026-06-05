/**
 * @module send
 *
 * SMTP email delivery via denomailer. Configuration is read from environment
 * variables: `SMTP_HOST`, `SMTP_PORT`, optional `SMTP_USER`/`SMTP_PASS`, and
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

function isLocalMailpit(host: string, port: number): boolean {
  return (host === "127.0.0.1" || host === "localhost") && port === 1025;
}

/**
 * Return the lazily-created SMTP client. Throws if `SMTP_HOST` is missing or
 * if SMTP auth is only partially configured.
 *
 * @returns A connected {@link SMTPClient}.
 */
function getSmtpClient(): SMTPClient {
  if (smtpClient) return smtpClient;

  const host = Deno.env.get("SMTP_HOST");
  const port = Number(Deno.env.get("SMTP_PORT") ?? "587");
  const username = Deno.env.get("SMTP_USER");
  const password = Deno.env.get("SMTP_PASS");
  const allowUnsecure = Deno.env.get("SMTP_ALLOW_UNSECURE") === "true" ||
    isLocalMailpit(host ?? "", port);

  if (!host) {
    throw new Error("SMTP_HOST environment variable is required");
  }

  if ((username && !password) || (!username && password)) {
    throw new Error("SMTP_USER and SMTP_PASS must be provided together");
  }

  smtpClient = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls: port === 465,
      ...(username && password ? { auth: { username, password } } : {}),
    },
    debug: {
      allowUnsecure,
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
