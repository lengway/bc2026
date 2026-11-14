import { z } from 'zod';
import {
  RegisterRequest, LoginRequest, ResetPasswordRequest, ChangePasswordRequest, ChangeEmailRequest,
  UpdateAccountRequest, DeleteAccountRequest, ForgotPasswordRequest,
} from '@/contracts';
import { AppError, systemClock } from '@/modules/shared';
import type { IdentityDeps } from './service';
import { consumeRateLimit, toUser } from './repo';
import { hashToken } from './security';
import { hashPassword, verifyPassword } from './password';
import { AccountRow, accountSession, authorizeSensitive, consumeAccountToken, eraseAccount, issueMailToken, issueSession, userColumns, type MailPurpose } from './account-repo';

export function createAccountService({ db, mailer, appUrl, now = systemClock, onEmailVerified }: IdentityDeps) {
  const accepted = () => ({ accepted: true as const });
  async function deliver(email: string, purpose: MailPurpose, token: string | null, preserveOnFailure = false) {
    const url = token ? new URL(purpose === 'reset_password' ? '/reset-password' : '/verify-email', appUrl) : null;
    if (url && token) url.searchParams.set('token', token);
    try {
      if (!mailer.sendAccountMail) throw new Error('Account mail delivery is not configured');
      await mailer.sendAccountMail(email, purpose, url?.toString()??null);
    } catch {
      if (token && !preserveOnFailure) await db.query('DELETE FROM auth_tokens WHERE token_hash=$1 AND consumed_at IS NULL', [hashToken(token)]);
      throw new AppError('VALIDATION', 503, 'Unable to send an account email. Please try again.');
    }
  }
  async function sensitiveLimit(token: string | null) {
    await consumeRateLimit(db, `account:session:${hashToken(token??'missing')}`, 10, 900_000, now());
  }
  async function invalidateOtherSessions(userId: string, keep: string | null, at: Date, tx = db as import('@/modules/database').SqlExecutor) {
    await tx.query('UPDATE sessions SET revoked_at=$3 WHERE user_id=$1 AND ($2::uuid IS NULL OR id<>$2) AND revoked_at IS NULL', [userId, keep, at]);
    await tx.query('UPDATE auth_tokens SET consumed_at=$2 WHERE user_id=$1 AND consumed_at IS NULL', [userId, at]);
  }
  return {
    async register(input: RegisterRequest, requestKey: string) {
      const data = RegisterRequest.parse(input), at = now();
      await consumeRateLimit(db, `register:ip:${hashToken(requestKey)}`, 20, 3_600_000, at);
      await consumeRateLimit(db, `register:email:${hashToken(data.email)}`, 3, 3_600_000, at);
      // Do the same password work for an existing email; never replace its password/name.
      const passwordHash = await hashPassword(data.password);
      const token = await db.transaction(async tx => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,7041))', [data.email]);
        await tx.query('INSERT INTO users(email,display_name,password_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [data.email, data.displayName, passwordHash]);
        const user = AccountRow.parse((await tx.query('SELECT * FROM users WHERE lower(email)=$1 FOR UPDATE', [data.email])).rows[0]);
        if (user.is_guest || user.email_verified_at) return null;
        return issueMailToken(tx, user.id, 'verify_email', at, { email: user.email, passwordHash, displayName: data.displayName });
      });
      await deliver(data.email, 'verify_email', token);
      return accepted();
    },
    async resendVerification(session: string | null, requestKey: string) {
      const at = now();
      const owner = await db.transaction(tx => accountSession(tx, session, at));
      if (owner.email_verified_at) return accepted();
      await consumeRateLimit(db, `register:ip:${hashToken(requestKey)}`, 20, 3_600_000, at);
      await consumeRateLimit(db, `register:email:${hashToken(owner.email)}`, 3, 3_600_000, at);
      const proof = await db.transaction(async tx => {
        const account = await accountSession(tx, session, at);
        if (account.email_verified_at) return null;
        // The most recent signup proof may carry the mailbox owner's credentials
        // even when this session belongs to an earlier provisional registration.
        const pending = await tx.query(`SELECT meta FROM auth_tokens WHERE user_id=$1 AND purpose='verify_email'
          AND consumed_at IS NULL ORDER BY expires_at DESC LIMIT 1`, [account.id]);
        const parsed = z.record(z.string(),z.unknown()).safeParse(pending.rows[0]?.meta);
        if (!parsed.success || parsed.data.email !== account.email) throw new AppError('FORBIDDEN',403,'Sign in with an email link to confirm your address.');
        const token = await issueMailToken(tx, account.id, 'verify_email', at, parsed.data);
        return { email: account.email, token };
      });
      if (proof) await deliver(proof.email, 'verify_email', proof.token, true);
      return accepted();
    },
    async login(input: LoginRequest, requestKey: string, existingToken: string | null = null) {
      const data = LoginRequest.parse(input), at = now();
      // Autocommit counters: a failed credential transaction must not undo the limit.
      await consumeRateLimit(db, `login:pair:${hashToken(data.email+'\n'+requestKey)}`, 10, 900_000, at);
      await consumeRateLimit(db, `login:ip:${hashToken(requestKey)}`, 100, 900_000, at);
      const result = await db.query('SELECT * FROM users WHERE lower(email)=$1', [data.email]);
      const account = result.rows[0] ? AccountRow.parse(result.rows[0]) : null;
      const valid = await verifyPassword(data.password, account?.password_hash??null);
      if (!valid || !account || account.is_guest) throw new AppError('UNAUTHORIZED', 401, 'Email or password is incorrect.');
      return db.transaction(async tx => {
        const current = (await tx.query('SELECT password_hash FROM users WHERE id=$1 FOR UPDATE', [account.id])).rows[0];
        if (!current || current.password_hash !== account.password_hash) throw new AppError('UNAUTHORIZED', 401, 'Email or password is incorrect.');
        return issueSession(tx, account.id, at, existingToken);
      });
    },
    async verifyEmail(token: string) {
      const at = now();
      return db.transaction(async tx => {
        const proof = await consumeAccountToken(tx, token, ['verify_email','change_email'], at);
        if (proof.meta.email !== proof.account.email) throw new AppError('UNAUTHORIZED', 401, 'This link is no longer valid.');
        if (proof.purpose === 'change_email') {
          const email = ForgotPasswordRequest.parse({ email: proof.meta.newEmail }).email;
          const exists = await tx.query('SELECT id FROM users WHERE lower(email)=$1 AND id<>$2', [email, proof.account.id]);
          if (exists.rows.length) throw new AppError('VALIDATION', 409, 'Unable to change this email address.');
          try { await tx.query('UPDATE users SET email=$2,email_verified_at=$3 WHERE id=$1', [proof.account.id, email, at]); }
          catch(error) {
            if(typeof error==='object'&&error!==null&&'code' in error&&error.code==='23505') throw new AppError('VALIDATION',409,'Unable to change this email address.');
            throw error;
          }
        } else {
          if (typeof proof.meta.passwordHash !== 'string' || !proof.meta.passwordHash.startsWith('$argon2id$') || typeof proof.meta.displayName !== 'string') throw new AppError('UNAUTHORIZED',401,'This link is no longer valid.');
          await tx.query('UPDATE users SET email_verified_at=$2,password_hash=$3,display_name=$4 WHERE id=$1', [proof.account.id, at, proof.meta.passwordHash, proof.meta.displayName]);
        }
        if (!proof.account.email_verified_at) await onEmailVerified?.(tx, proof.account.id);
        await invalidateOtherSessions(proof.account.id, null, at, tx);
        return { ok: true as const, ...await issueSession(tx, proof.account.id, at) };
      });
    },
    async forgotPassword(emailInput: string, requestKey: string) {
      const { email } = ForgotPasswordRequest.parse({ email: emailInput }), at = now();
      await consumeRateLimit(db, `reset:email:${hashToken(email)}`, 3, 3_600_000, at);
      await consumeRateLimit(db, `reset:ip:${hashToken(requestKey)}`, 20, 3_600_000, at);
      const token = await db.transaction(async tx => {
        const result = await tx.query('SELECT * FROM users WHERE lower(email)=$1 FOR UPDATE', [email]);
        if (!result.rows[0]) return null;
        const user = AccountRow.parse(result.rows[0]);
        return user.is_guest ? null : issueMailToken(tx, user.id, 'reset_password', at, { email: user.email });
      });
      // Both cases use the mail transport. A missing account gets a generic explanation, no token.
      await deliver(email, 'reset_password', token);
      return accepted();
    },
    async resetPassword(input: ResetPasswordRequest, existingToken: string | null = null) {
      const data = ResetPasswordRequest.parse(input), at = now();
      const passwordHash = await hashPassword(data.password);
      await db.transaction(async tx => {
        const proof = await consumeAccountToken(tx, data.token, ['reset_password'], at);
        if (proof.meta.email !== proof.account.email) throw new AppError('UNAUTHORIZED', 401, 'This link is no longer valid.');
        const session = existingToken ? (await tx.query('SELECT id FROM sessions WHERE user_id=$1 AND token_hash=$2 AND revoked_at IS NULL AND expires_at>$3', [proof.account.id, hashToken(existingToken), at])).rows[0] : null;
        await tx.query('UPDATE users SET password_hash=$2,email_verified_at=COALESCE(email_verified_at,$3) WHERE id=$1', [proof.account.id, passwordHash, at]);
        if (!proof.account.email_verified_at) await onEmailVerified?.(tx, proof.account.id);
        await invalidateOtherSessions(proof.account.id, typeof session?.id === 'string' ? session.id : null, at, tx);
      });
      return { ok: true as const };
    },
    async getAccount(token: string | null) {
      return db.transaction(async tx => {
        const account = await accountSession(tx, token, now());
        return toUser({ ...account, has_password: account.password_hash !== null });
      });
    },
    async updateAccount(token: string | null, input: UpdateAccountRequest) {
      const data = UpdateAccountRequest.parse(input);
      return db.transaction(async tx => {
        const account = await accountSession(tx, token, now());
        return toUser((await tx.query(`UPDATE users SET display_name=$2 WHERE id=$1 RETURNING ${userColumns}`, [account.id, data.displayName])).rows[0]);
      });
    },
    async changePassword(token: string | null, input: ChangePasswordRequest) {
      const data = ChangePasswordRequest.parse(input), at = now();
      await sensitiveLimit(token);
      const passwordHash = await hashPassword(data.password);
      await db.transaction(async tx => {
        const account = await accountSession(tx, token, at);
        await authorizeSensitive(account, data.currentPassword, at);
        await tx.query('UPDATE users SET password_hash=$2 WHERE id=$1', [account.id, passwordHash]);
        await invalidateOtherSessions(account.id, account.session_id, at, tx);
      });
      return { ok: true as const };
    },
    async changeEmail(token: string | null, input: ChangeEmailRequest) {
      const data = ChangeEmailRequest.parse(input), at = now();
      await sensitiveLimit(token);
      const proof = await db.transaction(async tx => {
        const account = await accountSession(tx, token, at);
        await authorizeSensitive(account, data.currentPassword, at);
        return issueMailToken(tx, account.id, 'change_email', at, { email: account.email, newEmail: data.email, sessionId: account.session_id });
      });
      await deliver(data.email, 'change_email', proof);
      return accepted();
    },
    async logoutAll(token: string | null) {
      await db.transaction(async tx => {
        const account = await accountSession(tx, token, now());
        await invalidateOtherSessions(account.id, null, now(), tx);
      });
      return { ok: true as const };
    },
    async deleteAccount(token: string | null, input: DeleteAccountRequest) {
      const data = DeleteAccountRequest.parse(input), at = now();
      await sensitiveLimit(token);
      await db.transaction(async tx => {
        const account = await accountSession(tx, token, at);
        await authorizeSensitive(account, data.currentPassword, at);
        await eraseAccount(tx, account.id);
      });
      return { ok: true as const };
    },
  };
}
