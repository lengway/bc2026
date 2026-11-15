import type { MailPurpose } from "./account-repo";

type EmailPurpose = MailPurpose | "magic_link";

const messages = {
  magic_link: {
    subject: "Your Gambit sign-in link",
    title: "Sign in to Gambit",
    description: "Use this link to sign in to your Gambit account.",
    expiry: "15 minutes",
  },
  verify_email: {
    subject: "Gambit: Confirm your email",
    title: "Confirm your email",
    description: "Confirm this email address to finish setting up your Gambit account.",
    expiry: "24 hours",
  },
  change_email: {
    subject: "Gambit: Confirm your new email",
    title: "Confirm your new email",
    description: "Confirm this address to update the email on your Gambit account.",
    expiry: "24 hours",
  },
  reset_password: {
    subject: "Gambit: Reset your password",
    title: "Reset your password",
    description: "Use this link to choose a new password for your Gambit account.",
    expiry: "30 minutes",
  },
} satisfies Record<EmailPurpose, { subject: string; title: string; description: string; expiry: string }>;

const accountNotice = {
  title: "Gambit account request",
  description:
    "If you already have an account, you can sign in with your password or request an email sign-in link. Otherwise, you can create an account.",
};

const ignoreNotice = "If you did not make this request, you can ignore this email.";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderIdentityEmail(purpose: EmailPurpose, url: string | null) {
  const message = messages[purpose];
  const { title, description } = url ? message : accountNotice;
  const expiryNotice = `This link expires in ${message.expiry} and can be used once.`;
  const fallback = "If the button doesn’t work, copy and paste this link into your browser.";
  const text = url
    ? [title, description, url, expiryNotice, ignoreNotice].join("\n\n")
    : [title, description, ignoreNotice].join("\n\n");
  const escapedUrl = url ? escapeHtml(url) : null;
  const action = escapedUrl
    ? `<p style="margin:24px 0 16px;">
      <a href="${escapedUrl}" style="display:inline-block;background-color:#1b2a5c;border:1px solid #1b2a5c;border-radius:6px;padding:12px 18px;color:#ffffff;font-size:16px;font-weight:bold;line-height:22px;text-decoration:none;mso-padding-alt:0;text-underline-color:#1b2a5c;">
        <!--[if mso]><i style="mso-font-width:150%;mso-text-raise:16pt;">&nbsp;</i><![endif]--><span style="mso-text-raise:8pt;">${escapeHtml(title)}</span><!--[if mso]><i style="mso-font-width:150%;">&nbsp;</i><![endif]-->
      </a>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#52525b;">This single-use link expires in <strong style="color:#1b2a5c;">${message.expiry}</strong>.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr><td style="padding:12px 16px;background-color:#f3f5fb;border:1px solid #cdd3e8;border-radius:6px;">
        <p style="margin:0 0 6px;font-size:14px;color:#52525b;">${fallback}</p>
        <p style="margin:0;font-size:14px;word-break:break-all;overflow-wrap:anywhere;"><a href="${escapedUrl}" style="color:#1b2a5c;text-decoration:underline;">${escapedUrl}</a></p>
      </td></tr>
    </table>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;color:#18181b;font-family:Geist,Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e4e4e7;border-top:4px solid #1b2a5c;border-radius:8px;">
          <tr>
            <td align="left" style="padding:28px 24px;">
              <p style="margin:0 0 20px;color:#1b2a5c;font-size:18px;font-weight:bold;">Gambit</p>
              <h1 style="margin:0 0 12px;font-size:28px;font-weight:bold;line-height:1.2;">${escapeHtml(title)}</h1>
              <p style="margin:0;">${escapeHtml(description)}</p>
              ${action}
              <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e4e4e7;color:#52525b;font-size:14px;">${ignoreNotice}</p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: message.subject, text, html };
}
