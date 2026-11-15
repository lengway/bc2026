import { z } from 'zod';
import type { SqlExecutor } from '@/modules/database';
import { AppError } from '@/modules/shared';
import type { BillingEvent } from './provider';

const User = z.object({ id: z.uuid(), isGuest: z.boolean(), status: z.enum(['free','pro']).nullable(), customerId: z.string().nullable(), subscriptionId: z.string().nullable(), periodEnd: z.date().nullable(), lastEventCreated: z.coerce.number().nullable() });
export type BillingUser = z.infer<typeof User>;
export async function getUser(db: SqlExecutor, userId: string, lock = false): Promise<BillingUser> {
  const { rows } = await db.query(`SELECT u.id,u.is_guest AS "isGuest",s.status,s.stripe_customer_id AS "customerId",
    s.stripe_subscription_id AS "subscriptionId",s.current_period_end AS "periodEnd",s.last_event_created AS "lastEventCreated"
    FROM users u LEFT JOIN subscriptions s ON s.user_id=u.id WHERE u.id=$1 ${lock ? 'FOR UPDATE OF u' : ''}`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND',404,'User account not found.');
  return User.parse(rows[0]);
}
export async function hasRecentFreeCase(db: SqlExecutor, userId: string, since: Date): Promise<boolean> {
  const { rows } = await db.query(`SELECT c.id FROM cases c WHERE c.user_id=$1 AND c.type IN ('daily','prep') AND c.created_at>$2
    AND (c.started_at IS NOT NULL OR c.submitted_at IS NOT NULL OR (c.status<>'failed' AND NOT EXISTS(
      SELECT 1 FROM jobs j WHERE j.case_id=c.id AND j.kind='case.generate' AND j.status='failed'
    ))) LIMIT 1`, [userId,since]);
  return rows.length > 0;
}
export async function saveCheckout(db: SqlExecutor, id: string, userId: string, priceId: string, now: Date) {
  await db.query('INSERT INTO billing_checkout_sessions(session_id,user_id,price_id,created_at) VALUES($1,$2,$3,$4)', [id,userId,priceId,now]);
}
export async function getCheckout(db: SqlExecutor, id: string) {
  const { rows } = await db.query('SELECT user_id AS "userId",price_id AS "priceId" FROM billing_checkout_sessions WHERE session_id=$1', [id]);
  return rows[0] ? z.object({ userId: z.uuid(), priceId: z.string().min(1) }).parse(rows[0]) : null;
}
export async function getBinding(db: SqlExecutor, id: string) {
  const { rows } = await db.query('SELECT user_id AS "userId",customer_id AS "customerId" FROM billing_subscription_bindings WHERE subscription_id=$1', [id]);
  return rows[0] ? z.object({ userId: z.uuid(), customerId: z.string().min(1) }).parse(rows[0]) : null;
}
export async function rememberEvent(db: SqlExecutor, event: BillingEvent, now: Date): Promise<boolean> {
  const result = await db.query('INSERT INTO billing_webhook_events(id,type,event_created,processed_at) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id', [event.id,event.type,event.created,now]);
  return result.rows.length === 1;
}
export async function eventProcessed(db: SqlExecutor, id: string): Promise<boolean> {
  return (await db.query('SELECT id FROM billing_webhook_events WHERE id=$1', [id])).rows.length > 0;
}
export async function bindSubscription(db: SqlExecutor, subscriptionId: string, userId: string, customerId: string, sessionId: string, now: Date) {
  await db.query('INSERT INTO billing_subscription_bindings(subscription_id,user_id,customer_id,checkout_session_id,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(subscription_id) DO NOTHING', [subscriptionId,userId,customerId,sessionId,now]);
}
export async function saveSubscription(db: SqlExecutor, input: { userId: string; customerId: string; subscriptionId: string; pro: boolean; periodEnd: Date; eventCreated: number; now: Date }) {
  await db.query(`INSERT INTO subscriptions(user_id,status,stripe_customer_id,stripe_subscription_id,current_period_end,last_event_created,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id) DO UPDATE SET status=EXCLUDED.status,
    stripe_customer_id=EXCLUDED.stripe_customer_id,stripe_subscription_id=EXCLUDED.stripe_subscription_id,
    current_period_end=EXCLUDED.current_period_end,last_event_created=EXCLUDED.last_event_created,updated_at=EXCLUDED.updated_at`,
  [input.userId,input.pro ? 'pro' : 'free',input.customerId,input.subscriptionId,input.periodEnd,input.eventCreated,input.now]);
}
