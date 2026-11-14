import { z } from 'zod';
import type { SqlExecutor } from '@/modules/database';
import { AppError } from '@/modules/shared';
import { hashToken, newToken } from './security';
import { toUser } from './repo';
import { verifyPassword } from './password';

export const AccountRow = z.object({ id: z.uuid(), email: z.string(), password_hash: z.string().nullable(), display_name: z.string().nullable(), is_guest: z.boolean(), email_verified_at: z.coerce.date().nullable() });
export const userColumns = 'id,email,display_name,is_guest,email_verified_at,(password_hash IS NOT NULL) AS has_password';
export async function issueSession(tx: SqlExecutor, userId: string, at: Date, oldToken?: string | null) {
  if (oldToken) await tx.query('UPDATE sessions SET revoked_at=$2 WHERE token_hash=$1 AND revoked_at IS NULL', [hashToken(oldToken), at]);
  const token = newToken();
  const expiresAt = new Date(at.getTime() + 30 * 86_400_000);
  await tx.query('INSERT INTO sessions(user_id,token_hash,expires_at,created_at,authenticated_at) VALUES($1,$2,$3,$4,$4)', [userId, hashToken(token), expiresAt, at]);
  const user = toUser((await tx.query(`SELECT ${userColumns} FROM users WHERE id=$1`, [userId])).rows[0]);
  return { token, session: { user, expiresAt: expiresAt.toISOString() } };
}
export async function accountSession(tx: SqlExecutor, token: string | null, at: Date) {
  if (!token) throw new AppError('UNAUTHORIZED', 401, 'Sign in to continue.');
  const result = await tx.query(`SELECT u.*,s.id AS session_id,s.authenticated_at
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>$2 FOR UPDATE OF u`, [hashToken(token), at]);
  if (!result.rows[0]) throw new AppError('UNAUTHORIZED', 401, 'Sign in to continue.');
  const account = AccountRow.extend({ session_id: z.uuid(), authenticated_at: z.coerce.date() }).parse(result.rows[0]);
  // The user lock may have waited for logout-all; refresh the session predicate after acquiring it.
  const active = await tx.query('SELECT id FROM sessions WHERE id=$1 AND revoked_at IS NULL AND expires_at>$2', [account.session_id, at]);
  if (!active.rows.length) throw new AppError('UNAUTHORIZED', 401, 'Sign in to continue.');
  if (account.is_guest) throw new AppError('FORBIDDEN', 403, 'Guest sessions cannot manage an account.');
  return account;
}
export async function authorizeSensitive(account: Awaited<ReturnType<typeof accountSession>>, currentPassword: string | undefined, at: Date) {
  if (account.password_hash ? !await verifyPassword(currentPassword??'', account.password_hash) : account.authenticated_at.getTime() < at.getTime()-900_000) {
    throw new AppError('FORBIDDEN', 403, 'Confirm your current password or sign in with a fresh email link.');
  }
}
export type MailPurpose = 'verify_email' | 'reset_password' | 'change_email';
export async function issueMailToken(tx: SqlExecutor, userId: string, purpose: MailPurpose, at: Date, meta: Record<string, unknown> = {}) {
  const token = newToken();
  await tx.query('UPDATE auth_tokens SET consumed_at=$3 WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL', [userId, purpose, at]);
  await tx.query('INSERT INTO auth_tokens(user_id,token_hash,purpose,meta,expires_at) VALUES($1,$2,$3,$4,$5)',
    [userId, hashToken(token), purpose, JSON.stringify(meta), new Date(at.getTime()+(purpose==='reset_password'?1_800_000:86_400_000))]);
  return token;
}
export async function consumeAccountToken(tx: SqlExecutor, token: string, purposes: MailPurpose[], at: Date) {
  const hash = hashToken(token);
  const initial = await tx.query('SELECT user_id FROM auth_tokens WHERE token_hash=$1 AND purpose=ANY($2::text[])', [hash, purposes]);
  if (!initial.rows[0]) throw new AppError('UNAUTHORIZED', 401, 'This link has expired or was already used.');
  const account = AccountRow.parse((await tx.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [initial.rows[0].user_id])).rows[0]);
  const result = await tx.query(`UPDATE auth_tokens SET consumed_at=$3 WHERE token_hash=$1 AND purpose=ANY($2::text[])
    AND consumed_at IS NULL AND expires_at>$3 RETURNING purpose,meta`, [hash, purposes, at]);
  if (!result.rows[0] || account.is_guest) throw new AppError('UNAUTHORIZED', 401, 'This link has expired or was already used.');
  return { account, ...z.object({ purpose: z.enum(['verify_email','reset_password','change_email']), meta: z.record(z.string(), z.unknown()) }).parse(result.rows[0]) };
}

export async function eraseAccount(tx: SqlExecutor, userId: string) {
  // Lock cases before removing their records so in-flight workers cannot commit a partial result.
  await tx.query('SELECT id FROM cases WHERE user_id=$1 FOR UPDATE', [userId]);
  await tx.query('SET CONSTRAINTS events_draft_fk DEFERRED');
  const caseTables = ['jobs','certificates','practice_completions','progress_awards','simulation_operations','editor_batches','editor_events','interaction_windows','move_reviews','editor_drafts','events','persona_state','personas','rubrics','evaluations'];
  for (const table of caseTables) await tx.query(`DELETE FROM ${table} WHERE case_id IN (SELECT id FROM cases WHERE user_id=$1)`, [userId]);
  await tx.query('DELETE FROM llm_calls WHERE user_id=$1 OR case_id IN (SELECT id FROM cases WHERE user_id=$1)', [userId]);
  await tx.query('DELETE FROM cases WHERE user_id=$1', [userId]);
  for (const table of ['billing_subscription_bindings','billing_checkout_sessions','subscriptions','profiles','skill_progress','streaks','auth_tokens','sessions']) await tx.query(`DELETE FROM ${table} WHERE user_id=$1`, [userId]);
  await tx.query('DELETE FROM rate_limits WHERE key LIKE $1 OR key LIKE $2', [`%${userId}%`, `%${hashToken(userId)}%`]);
  await tx.query('DELETE FROM users WHERE id=$1', [userId]);
}
