import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { MagicLinkRequest, SessionView } from '@/contracts';
import type { Database } from '@/modules/database';
import { AppError, type Clock, systemClock } from '@/modules/shared';
import { consumeRateLimit, findSession, toUser } from './repo';
import { hashToken, newToken } from './security';

export interface MagicLinkMailer { sendMagicLink(email: string, url: string): Promise<void> }
export interface IdentityDeps { db: Database; mailer: MagicLinkMailer; appUrl: string; guestAccessEnabled?: boolean; now?: Clock }

export function createIdentityService({ db, mailer, appUrl, guestAccessEnabled = false, now = systemClock }: IdentityDeps) {
  return {
    async requestMagicLink(emailInput: string, requestKey: string) {
      const { email: rawEmail } = MagicLinkRequest.parse({ email: emailInput });
      const email = rawEmail.toLowerCase();
      if (email.endsWith('.invalid')) throw new AppError('VALIDATION', 400, 'Use a deliverable email address.');
      const token = newToken();
      const hash = hashToken(token);
      const at = now();
      await db.transaction(async (tx) => {
        await consumeRateLimit(tx, `magic:email:${hashToken(email)}`, 5, 900_000, at);
        await consumeRateLimit(tx, `magic:ip:${hashToken(requestKey)}`, 20, 900_000, at);
        const result = await tx.query(`INSERT INTO users(email) VALUES($1)
          ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id,email,display_name,is_guest`, [email]);
        const user = toUser(result.rows[0]);
        await tx.query('INSERT INTO auth_tokens(user_id,token_hash,expires_at) VALUES($1,$2,$3)', [user.id, hash, new Date(at.getTime() + 900_000)]);
      });
      const url = new URL('/api/auth/verify', appUrl);
      url.searchParams.set('token', token);
      try { await mailer.sendMagicLink(email, url.toString()); }
      catch {
        await db.query('DELETE FROM auth_tokens WHERE token_hash=$1 AND consumed_at IS NULL', [hash]);
        throw new AppError('VALIDATION', 503, 'Unable to send a sign-in email. Please try again.');
      }
      return { accepted: true as const };
    },
    async consumeMagicLink(token: string) {
      const at = now();
      const sessionToken = newToken();
      const expiresAt = new Date(at.getTime() + 30 * 86_400_000);
      const user = await db.transaction(async (tx) => {
        const result = await tx.query(`UPDATE auth_tokens SET consumed_at=$2
          WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>$2 RETURNING user_id`, [hashToken(token), at]);
        if (!result.rows[0]) throw new AppError('UNAUTHORIZED', 401, 'This sign-in link has expired or was already used.');
        const { user_id } = z.object({ user_id: z.uuid() }).parse(result.rows[0]);
        const users = await tx.query('SELECT id,email,display_name,is_guest FROM users WHERE id=$1', [user_id]);
        await tx.query('INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3)', [user_id, hashToken(sessionToken), expiresAt]);
        return toUser(users.rows[0]);
      });
      return { token: sessionToken, session: SessionView.parse({ user, expiresAt: expiresAt.toISOString() }) };
    },
    async getSession(token: string | null) {
      if (!token) return null;
      const session = SessionView.parse(await findSession(db, hashToken(token), now()));
      return session?.user.isGuest && !guestAccessEnabled ? null : session;
    },
    async createGuestSession(requestKey: string, existingToken: string | null = null) {
      if (!guestAccessEnabled) throw new AppError('FORBIDDEN', 403, 'Guest access is disabled.');
      if (existingToken) {
        const session = SessionView.parse(await findSession(db, hashToken(existingToken), now()));
        if (session) return {token:existingToken,session};
      }
      const token = newToken();
      const at = now();
      const expiresAt = new Date(at.getTime() + 86_400_000);
      const user = await db.transaction(async (tx) => {
        await consumeRateLimit(tx, `guest:ip:${hashToken(requestKey)}`, 10, 3_600_000, at);
        await consumeRateLimit(tx, 'guest:global', 100, 86_400_000, at);
        const users = await tx.query(`INSERT INTO users(email,display_name,is_guest) VALUES($1,'Demo Guest',true)
          RETURNING id,email,display_name,is_guest`, [`${randomUUID()}@guest.invalid`]);
        const guest = toUser(users.rows[0]);
        await tx.query('INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3)', [guest.id, hashToken(token), expiresAt]);
        return guest;
      });
      return { token, session: SessionView.parse({user,expiresAt:expiresAt.toISOString()}) };
    },
    async revokeSession(token: string | null) {
      if (token) await db.query('UPDATE sessions SET revoked_at=$2 WHERE token_hash=$1 AND revoked_at IS NULL', [hashToken(token), now()]);
    },
  };
}
export type IdentityService = ReturnType<typeof createIdentityService>;
