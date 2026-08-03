/**
 * @module templates
 *
 * HTML email templates for the nr-bridge verification and support flows.
 */

/** Escape text that will be interpolated into an HTML template. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Parameters for {@link buildVerificationEmail}. */
interface VerificationEmailParams {
  /** The six-digit verification code to display prominently. */
  code: string;
  /** Number of minutes before the code expires. */
  expiryMinutes: number;
  /** Full deep-link URL. When absent the button is omitted from the email. */
  deepLink?: string;
}

/**
 * Build the verification email subject and HTML body.
 *
 * The resulting email contains:
 * - A large, styled six-digit code for manual entry.
 * - Optionally, a deep-link button that opens the nr-app iOS app directly.
 * - An expiry notice.
 *
 * @param params - Code, expiry duration, and optional deep-link URL.
 * @returns An object with `subject` and `html` strings ready for
 *          {@link sendEmail}.
 */
export function buildVerificationEmail(params: VerificationEmailParams): {
  subject: string;
  html: string;
} {
  const { code, expiryMinutes, deepLink } = params;

  const subject = `Your Nostroots verification code: ${code}`;

  const deepLinkSection = deepLink
    ? `<p style="margin:0 0 24px;color:#333333;font-size:16px;line-height:1.5;">
                Or tap the button below to open the app directly:
              </p>
              <div style="text-align:center;margin:0 0 32px;">
                <a href="${deepLink}" style="display:inline-block;background-color:#2d6a4f;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;">
                  Open Nostroots
                </a>
              </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your Nostroots account</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:#2d6a4f;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Nostroots</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 24px;color:#333333;font-size:16px;line-height:1.5;">
                Enter this code in the Nostroots app to verify your identity:
              </p>
              <div style="text-align:center;margin:0 0 32px;">
                <span style="display:inline-block;background-color:#f0f7f4;border:2px solid #2d6a4f;border-radius:8px;padding:16px 32px;font-size:36px;font-weight:700;letter-spacing:8px;color:#2d6a4f;">
                  ${code}
                </span>
              </div>
              ${deepLinkSection}
              <p style="margin:0;color:#888888;font-size:13px;line-height:1.5;">
                This code expires in ${expiryMinutes} minutes. If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

/** Parameters for {@link buildSupportEmail}. */
interface SupportEmailParams {
  /** The message the user typed or the app pre-filled. */
  message: string;
  /** npub of the signer, verified against the request signature. */
  npub: string;
  /**
   * Trustroots username this npub is verified as, when the bridge has one on
   * file. Never taken from the client.
   */
  username?: string;
}

/**
 * Build the support email subject and HTML body.
 *
 * The sender identity in this email is derived entirely from the verified
 * NIP-98 signature and the bridge's own database, so whoever picks up the
 * ticket can trust it.
 *
 * @param params - Message text and verified sender identity.
 * @returns An object with `subject` and `html` strings ready for
 *          {@link sendEmail}.
 */
export function buildSupportEmail(params: SupportEmailParams): {
  subject: string;
  html: string;
} {
  const { message, npub, username } = params;

  const subject = `Nostroots support request from ${username ?? npub}`;

  const identityRows = [
    ["npub", npub],
    [
      "Trustroots user",
      username ? `${username} (verified)` : "not linked to a Trustroots account",
    ],
  ]
    .map(
      ([label, value]) =>
        `<tr>
                  <td style="padding:4px 16px 4px 0;color:#888888;font-size:13px;white-space:nowrap;">${label}</td>
                  <td style="padding:4px 0;color:#333333;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;">${
          escapeHtml(value)
        }</td>
                </tr>`,
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nostroots support request</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:#2d6a4f;padding:24px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Nostroots</h1>
              <p style="margin:4px 0 0;color:#c8e0d4;font-size:14px;">Support request from the app</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;">
                ${identityRows}
              </table>
              <pre style="margin:0;padding:20px;background-color:#f7f7f9;border-radius:8px;border:1px solid #e5e5ea;color:#333333;font-size:13px;line-height:1.6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word;">${
    escapeHtml(message)
  }</pre>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 32px;">
              <p style="margin:0;color:#888888;font-size:13px;line-height:1.5;">
                Sent from the Nostroots app. The npub above was verified by signature; the Trustroots username, when shown, comes from our own records rather than from the app.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
