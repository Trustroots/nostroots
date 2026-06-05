/**
 * @module templates
 *
 * HTML email templates for the nr-bridge verification flow.
 */

/** Parameters for {@link buildVerificationEmail}. */
interface VerificationEmailParams {
  /** The six-digit verification code to display prominently. */
  code: string;
  /** The UUID token embedded in the deep link URL. */
  token: string;
  /** Base URL for the iOS deep link (e.g. `nostroots://verify`). */
  deepLinkBase: string;
  /** Number of minutes before the code/token expires. */
  expiryMinutes: number;
}

/**
 * Build the verification email subject and HTML body.
 *
 * The resulting email contains:
 * - A large, styled six-digit code for manual entry.
 * - A deep-link button that opens the nr-app iOS app directly.
 * - An expiry notice.
 *
 * @param params - Code, token, deep-link base URL, and expiry duration.
 * @returns An object with `subject` and `html` strings ready for
 *          {@link sendEmail}.
 */
export function buildVerificationEmail(params: VerificationEmailParams): {
  subject: string;
  html: string;
} {
  const { code, token, deepLinkBase, expiryMinutes } = params;
  const deepLink = `${deepLinkBase}?token=${encodeURIComponent(token)}`;

  const subject = `Your Nostroots verification code: ${code}`;

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
              <p style="margin:0 0 24px;color:#333333;font-size:16px;line-height:1.5;">
                Or tap the button below to open the app directly:
              </p>
              <div style="text-align:center;margin:0 0 32px;">
                <a href="${deepLink}" style="display:inline-block;background-color:#2d6a4f;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;">
                  Open Nostroots
                </a>
              </div>
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
