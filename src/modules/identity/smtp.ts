import nodemailer from 'nodemailer';
import type { MagicLinkMailer } from './service';

export function createSmtpMailer(config: {host:string;port:number;secure:boolean;user?:string;password?:string;from:string}): MagicLinkMailer {
  const transport = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  });
  return { async sendMagicLink(email, url) {
    await transport.sendMail({ from: config.from, to: email, subject: 'Your Skills sign-in link',
      text: `Sign in to your Skills workspace:\n${url}\n\nThis link expires in 15 minutes and can be used once. If you did not request it, you can ignore this email.` });
  } };
}
