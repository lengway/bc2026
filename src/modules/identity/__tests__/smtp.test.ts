import { afterEach, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { createSmtpMailer } from '../smtp';
afterEach(()=>{vi.restoreAllMocks();});
it('uses Gambit and a parsed sender address, links with expiry, and no secrets in generic notices',async()=>{
  const sendMail=vi.fn().mockResolvedValue({});
  vi.spyOn(nodemailer,'createTransport').mockReturnValue({sendMail} as unknown as ReturnType<typeof nodemailer.createTransport>);
  const mailer=createSmtpMailer({host:'unused',port:587,secure:false,from:'Old Brand <mail@example.com>'});
  await mailer.sendMagicLink('member@example.com','https://gambit.example/api/auth/verify?token=test-proof');
  await mailer.sendAccountMail!('member@example.com','verify_email','https://gambit.example/verify-email?token=test-proof');
  await mailer.sendAccountMail!('member@example.com','reset_password','https://gambit.example/reset-password?token=test-proof');
  await mailer.sendAccountMail!('unknown@example.com','reset_password',null);
  for(const [mail] of sendMail.mock.calls) expect(mail.from).toEqual({name:'Gambit',address:'mail@example.com'});
  expect(sendMail.mock.calls[0][0].text).toContain('15 minutes');
  expect(sendMail.mock.calls[1][0].text).toContain('24 hours');
  expect(sendMail.mock.calls[2][0].text).toContain('30 minutes');
  expect(sendMail.mock.calls[3][0].text).not.toContain('token=');
});
