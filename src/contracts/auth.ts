import { z } from 'zod';
import { Id, NonEmpty, Timestamp } from './primitives';

export const MagicLinkRequest = z.strictObject({
  email: z.string().trim().max(254).pipe(z.email()),
  next: z.string().max(2048).optional(),
});
export type MagicLinkRequest = z.infer<typeof MagicLinkRequest>;

export const MagicLinkResponse = z.object({ accepted: z.literal(true) });
export type MagicLinkResponse = z.infer<typeof MagicLinkResponse>;

export const MagicLinkVerifyQuery = z.strictObject({
  token: NonEmpty.max(512),
});
export type MagicLinkVerifyQuery = z.infer<typeof MagicLinkVerifyQuery>;

// Successful verification returns a cookie and a redirect with an empty body.
export const MagicLinkVerifyResponse = z.void();
export type MagicLinkVerifyResponse = z.infer<typeof MagicLinkVerifyResponse>;

export const SessionUser = z.object({
  id: Id,
  email: z.email(),
  displayName: NonEmpty.nullable(),
  isGuest: z.boolean().default(false),
  emailVerified: z.boolean().default(false),
  hasPassword: z.boolean().default(false),
});
export type SessionUser = z.infer<typeof SessionUser>;

export const SessionView = z.object({
  user: SessionUser,
  expiresAt: Timestamp,
}).nullable();
export type SessionView = z.infer<typeof SessionView>;

export const LogoutResponse = z.object({ ok: z.literal(true) });
export type LogoutResponse = z.infer<typeof LogoutResponse>;

const AccountEmail = z.string().trim().max(254).pipe(z.email()).transform(value => value.toLowerCase())
  .refine(value => !value.endsWith('.invalid'), 'Use a deliverable email address.');
const NewPassword = z.string().min(10).max(128);
const CurrentPassword = z.string().min(1).max(128).optional();
export const RegisterRequest = z.strictObject({ email: AccountEmail, password: NewPassword, displayName: z.string().trim().min(1).max(100) });
export type RegisterRequest = z.infer<typeof RegisterRequest>;
export const LoginRequest = z.strictObject({ email: AccountEmail, password: z.string().min(1).max(128), next: z.string().max(2048).optional() });
export type LoginRequest = z.infer<typeof LoginRequest>;
export const VerifyEmailRequest = z.strictObject({ token: z.string().min(32).max(512) });
export const ForgotPasswordRequest = z.strictObject({ email: AccountEmail });
export const ResetPasswordRequest = z.strictObject({ token: z.string().min(32).max(512), password: NewPassword });
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequest>;
export const ChangePasswordRequest = z.strictObject({ currentPassword: CurrentPassword, password: NewPassword });
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;
export const ChangeEmailRequest = z.strictObject({ email: AccountEmail, currentPassword: CurrentPassword });
export type ChangeEmailRequest = z.infer<typeof ChangeEmailRequest>;
export const UpdateAccountRequest = z.strictObject({ displayName: z.string().trim().min(1).max(100) });
export type UpdateAccountRequest = z.infer<typeof UpdateAccountRequest>;
export const DeleteAccountRequest = z.strictObject({ confirm: z.literal('DELETE'), currentPassword: CurrentPassword });
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequest>;
export const LoginResponse = z.object({ session: SessionView.unwrap(), next: z.string() });
export const AccountResponse = SessionUser;
