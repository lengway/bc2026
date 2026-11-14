import nodemailer from "nodemailer";
import { renderIdentityEmail } from "./email-template";
import type { MagicLinkMailer } from "./service";

export function createSmtpMailer(config: {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
}): MagicLinkMailer {
  const from = {
    name: "Gambit",
    address: config.from.match(/<([^<>]+)>/)?.[1] ?? config.from.trim(),
  };
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  return {
    async sendMagicLink(email, url) {
      await transport.sendMail({
        from,
        to: email,
        ...renderIdentityEmail("magic_link", url),
      });
    },
    async sendAccountMail(email, purpose, url) {
      await transport.sendMail({
        from,
        to: email,
        ...renderIdentityEmail(purpose, url),
      });
    },
  };
}
