import { z } from 'zod';
import { SessionUser } from '@/contracts';
import type { SqlExecutor } from '@/modules/database';
import { AppError } from '@/modules/shared';

const UserRow = z.object({ id: z.uuid(), email: z.email(), display_name: z.string().nullable(), is_guest: z.boolean() });
export const toUser = (row: unknown) => {
  const value = UserRow.parse(row);
  return SessionUser.parse({ id: value.id, email: value.email, displayName: value.display_name, isGuest: value.is_guest });
};

export async function consumeRateLimit(tx: SqlExecutor, key: string, max: number, windowMs: number, now: Date): Promise<void> {
  const result = await tx.query(`INSERT INTO rate_limits(key,window_start,count) VALUES($1,$2,1)
    ON CONFLICT(key) DO UPDATE SET
      count=CASE WHEN rate_limits.window_start <= $2::timestamptz - $3::double precision * interval '1 millisecond' THEN 1 ELSE rate_limits.count+1 END,
      window_start=CASE WHEN rate_limits.window_start <= $2::timestamptz - $3::double precision * interval '1 millisecond' THEN $2 ELSE rate_limits.window_start END
    RETURNING count`, [key, now, windowMs]);
  const { count } = z.object({ count: z.number().int() }).parse(result.rows[0]);
  if (count > max) throw new AppError('RATE_LIMIT', 429, 'Too many requests. Please try again later.');
}

export async function findSession(tx: SqlExecutor, hash: string, now: Date) {
  const result = await tx.query(`SELECT u.id,u.email,u.display_name,u.is_guest,s.expires_at
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>$2`, [hash, now]);
  if (!result.rows[0]) return null;
  const expiresAt = z.object({ expires_at: z.coerce.date() }).parse(result.rows[0]).expires_at;
  return { user: toUser(result.rows[0]), expiresAt: expiresAt.toISOString() };
}
