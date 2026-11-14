import nodemailer from 'nodemailer';
import type { MagicLinkMailer } from './service';

export function createSmtpMailer(config: {host:string;port:number;secure:boolean;user?:string;password?:string;from:string}): MagicLinkMailer {
  const from={name:'Gambit',address:config.from.match(/<([^<>]+)>/)?.[1]??config.from.trim()};
  const transport = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  });
  return { async sendMagicLink(email, url) {
    await transport.sendMail({ from, to: email, subject: 'Your Gambit sign-in link',
      text: `Sign in to Gambit:\n${url}\n\nThis link expires in 15 minutes and can be used once. If you did not request it, you can ignore this email.` });
  }, async sendAccountMail(email,purpose,url) {
    const reset=purpose==='reset_password';
    const action=reset?'Reset your password':purpose==='change_email'?'Confirm your new email':'Confirm your email';
    const text=url?`${action} for Gambit:\n${url}\n\nThis link expires in ${reset?'30 minutes':'24 hours'} and can be used once. If you did not request it, ignore this email.`:
      `We received an account request for Gambit. If you already have an account, sign in using your password or request an email sign-in link. Otherwise, you can create an account. If you did not request this email, ignore it.`;
    await transport.sendMail({from,to:email,subject:`Gambit: ${action}`,text});
  } };
}
