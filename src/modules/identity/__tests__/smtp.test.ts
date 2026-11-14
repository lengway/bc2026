import { expect, it, vi } from "vitest";
import nodemailer, { type SendMailOptions } from "nodemailer";
import { createSmtpMailer } from "../smtp";

function captureMail() {
  const sendMail = vi.fn<(message: SendMailOptions) => Promise<void>>().mockResolvedValue();
  vi.spyOn(nodemailer, "createTransport").mockReturnValue({
    sendMail,
  } as unknown as ReturnType<typeof nodemailer.createTransport>);
  return {
    mailer: createSmtpMailer({
      host: "unused",
      port: 587,
      secure: false,
      from: "Old Brand <mail@example.com>",
    }),
    sendMail,
  };
}

it.each([
  ["magic_link", "/api/auth/verify", "Your Gambit sign-in link", "Sign in to Gambit", "15 minutes"],
  ["verify_email", "/verify-email", "Gambit: Confirm your email", "Confirm your email", "24 hours"],
  ["change_email", "/verify-email", "Gambit: Confirm your new email", "Confirm your new email", "24 hours"],
  ["reset_password", "/reset-password", "Gambit: Reset your password", "Reset your password", "30 minutes"],
] as const)("sends the %s action and fallback in both formats", async (purpose, path, subject, action, expiry) => {
  const { mailer, sendMail } = captureMail();
  const email = "member@example.com";
  const url = `https://gambit.example${path}?token=test-proof&next=%2Freview`;

  if (purpose === "magic_link") await mailer.sendMagicLink(email, url);
  else await mailer.sendAccountMail!(email, purpose, url);

  expect(sendMail).toHaveBeenCalledTimes(1);
  const message = sendMail.mock.calls[0][0];
  expect(message).toMatchObject({ from: { name: "Gambit", address: "mail@example.com" }, to: email, subject });
  expect(message.text).toContain(action);
  expect(message.text).toContain(url);
  expect(message.text).toContain(expiry);
  expect(message.html).toContain(action);
  expect(message.html).toContain(expiry);
  expect(message.html).toContain(`href="${url.replaceAll("&", "&amp;")}"`);
  expect(message.html).toContain(`>${url.replaceAll("&", "&amp;")}</a>`);
});

it.each([
  ["verify_email", "Gambit: Confirm your email"],
  ["reset_password", "Gambit: Reset your password"],
] as const)("keeps the generic %s notice free of action links", async (purpose, subject) => {
  const { mailer, sendMail } = captureMail();
  await mailer.sendAccountMail!("member@example.com", purpose, null);
  const message = sendMail.mock.calls[0][0];
  expect(message.subject).toBe(subject);
  expect(message.text).toContain("If you already have an account");
  expect(message.text).not.toContain("token=");
  expect(message.html).toContain("If you already have an account");
  expect(message.html).not.toContain("href=");
  expect(message.html).not.toContain("token=");
});
