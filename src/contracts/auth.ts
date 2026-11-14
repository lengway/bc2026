import { z } from 'zod';
import { Id, NonEmpty, Timestamp } from './primitives';

export const MagicLinkRequest = z.strictObject({
  email: z.string().trim().max(254).pipe(z.email()),
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
});
export type SessionUser = z.infer<typeof SessionUser>;

export const SessionView = z.object({
  user: SessionUser,
  expiresAt: Timestamp,
}).nullable();
export type SessionView = z.infer<typeof SessionView>;

export const LogoutResponse = z.object({ ok: z.literal(true) });
export type LogoutResponse = z.infer<typeof LogoutResponse>;
