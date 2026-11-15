import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../../tests/backend/db-helper';
import { createBillingService, createStripeProvider, type BillingEvent, type BillingProvider, type BillingSubscription } from './index';

const instant = new Date('2026-11-14T12:00:00Z');
class FakeProvider implements BillingProvider {
  subscriptions = new Map<string, BillingSubscription>();
  sessions: { id: string; userId: string; priceId: string; customerId?: string }[] = [];
  constructEvent(raw: string, signature: string): BillingEvent {
    if (signature !== 'valid') throw new Error('invalid signature');
    return JSON.parse(raw) as BillingEvent;
  }
  async createCheckout(input: { userId: string; priceId: string; successUrl: string; cancelUrl: string; customerId?: string }) {
    const id = `cs_${randomUUID()}`;
    this.sessions.push({ id, userId: input.userId, priceId: input.priceId, customerId: input.customerId });
    return { id, url: `https://checkout.stripe.com/${id}` };
  }
  portals: { customerId: string; returnUrl: string }[] = [];
  async createPortal(input: { customerId: string; returnUrl: string }) {
    this.portals.push(input);
    return { url: 'https://billing.stripe.com/p/session' };
  }
  async retrieveSubscription(id: string) {
    const found = this.subscriptions.get(id);
    if (!found) throw new Error('missing subscription');
    return found;
  }
}

describe('billing with PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { fixture = await createTestDatabase(); });
  afterAll(async () => { await fixture?.cleanup(); });
  async function setup(guest = false) {
    const userId = randomUUID();
    await fixture.db.query('INSERT INTO users(id,email,is_guest) VALUES ($1,$2,$3)', [userId, `${userId}@example.test`, guest]);
    const provider = new FakeProvider();
    const billing = createBillingService({ db: fixture.db, provider, appUrl: 'http://localhost:3000', monthlyPriceId: 'price_month', yearlyPriceId: 'price_year', now: () => instant });
    return { userId, provider, billing };
  }
  async function activate(s: Awaited<ReturnType<typeof setup>>) {
    await s.billing.checkout(s.userId, 'monthly');
    const sub: BillingSubscription = { id: `sub_${randomUUID()}`, customerId: `cus_${randomUUID()}`, userId: s.userId, status: 'active', priceIds: ['price_month'], periodEnd: new Date(instant.getTime() + 86400000), livemode: false };
    s.provider.subscriptions.set(sub.id, sub);
    const event: BillingEvent = { id: `evt_${randomUUID()}`, type: 'checkout.session.completed', created: 100, livemode: false, sessionId: s.provider.sessions[0].id, subscriptionId: sub.id, customerId: sub.customerId, userId: s.userId };
    await s.billing.handleWebhook(JSON.stringify(event), 'valid');
    return { sub, event };
  }
  const send = (billing: ReturnType<typeof createBillingService>, event: BillingEvent) => billing.handleWebhook(JSON.stringify(event), 'valid');

  it('reports the current quota and only opens a portal for a bound Stripe customer', async () => {
    const s = await setup();
    expect(await s.billing.summary(s.userId)).toMatchObject({ plan: 'free', freeDailyRemaining: 1, canManage: false });
    await expect(s.billing.portal(s.userId)).rejects.toMatchObject({ status: 404 });
    const { sub } = await activate(s);
    expect(await s.billing.summary(s.userId)).toMatchObject({ plan:'pro', periodEnd: sub.periodEnd.toISOString(), canManage: true });
    expect(await s.billing.portal(s.userId)).toEqual({ url: 'https://billing.stripe.com/p/session' });
    expect(s.provider.portals).toEqual([{ customerId: sub.customerId, returnUrl: 'http://localhost:3000/settings/billing' }]);
  });

  it('enforces free and guest entitlements, counts failed generations correctly, and allows reuse after seven days', async () => {
    const { userId, billing } = await setup();
    expect(await billing.can(userId, 'start_case:onboarding')).toBe(true);
    expect(await billing.can(userId, 'start_case:daily')).toBe(true);
    expect(await billing.can(userId, 'start_case:weekly')).toBe(false);
    expect(await billing.can(userId, 'full_certificate')).toBe(false);
    const caseId = randomUUID();
    await fixture.db.query("INSERT INTO cases(id,user_id,field,subfield,type,workspace,status,created_at) VALUES($1,$2,'sales','sdr_outbound','daily','chat','failed',$3)", [caseId, userId, instant]);
    expect(await billing.can(userId, 'start_case:daily')).toBe(true);
    await fixture.db.query("UPDATE cases SET status='ready' WHERE id=$1", [caseId]);
    expect(await billing.can(userId, 'start_case:daily')).toBe(false);
    await fixture.db.query('UPDATE cases SET created_at=$2 WHERE id=$1', [caseId, new Date(instant.getTime() - 7*86400000)]);
    expect(await billing.can(userId, 'start_case:daily')).toBe(true);
    const guest = await setup(true);
    await expect(guest.billing.checkout(guest.userId, 'monthly')).rejects.toMatchObject({ status: 403 });
    expect(await guest.billing.can(guest.userId, 'start_case:weekly')).toBe(false);
  });

  it('serializes free quota when case creation uses the same locked transaction', async () => {
    const { userId, billing } = await setup();
    const start = () => fixture.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
      if (!await billing.can(userId, 'start_case:daily', tx)) return false;
      await tx.query("INSERT INTO cases(user_id,field,subfield,type,workspace,created_at) VALUES($1,'sales','sdr_outbound','daily','chat',$2)", [userId, instant]);
      return true;
    });
    expect((await Promise.all([start(), start()])).sort()).toEqual([false, true]);
  });

  it('keeps a daily slot consumed when evaluation fails after practice began', async () => {
    const { userId, billing } = await setup();
    const caseId = randomUUID();
    await fixture.db.query(`INSERT INTO cases(id,user_id,field,subfield,type,workspace,status,created_at,started_at,submitted_at)
      VALUES($1,$2,'sales','sdr_outbound','daily','chat','failed',$3,$3,$3)`, [caseId,userId,instant]);
    expect(await billing.can(userId, 'start_case:daily')).toBe(false);
    await fixture.db.query('UPDATE cases SET submitted_at=NULL WHERE id=$1',[caseId]);
    expect(await billing.can(userId, 'start_case:daily')).toBe(false);
    await fixture.db.query('UPDATE cases SET started_at=NULL,submitted_at=$2 WHERE id=$1',[caseId,instant]);
    expect(await billing.can(userId, 'start_case:daily')).toBe(false);
    await fixture.db.query('UPDATE cases SET submitted_at=NULL WHERE id=$1',[caseId]);
    expect(await billing.can(userId, 'start_case:daily')).toBe(true);
  });

  it('grants only after a verified checkout event with matching canonical subscription', async () => {
    const s = await setup();
    await s.billing.checkout(s.userId, 'monthly');
    expect(await s.billing.can(s.userId, 'full_certificate')).toBe(false);
    const sub: BillingSubscription = { id: 'sub_owner', customerId: 'cus_owner', userId: s.userId, status: 'active', priceIds: ['price_month'], periodEnd: new Date(instant.getTime() + 86400000), livemode: false };
    s.provider.subscriptions.set(sub.id, sub);
    const event: BillingEvent = { id: 'evt_checkout_owner', type: 'checkout.session.completed', created: 100, livemode: false, sessionId: s.provider.sessions[0].id, subscriptionId: sub.id, customerId: sub.customerId, userId: s.userId };
    await expect(s.billing.handleWebhook(JSON.stringify(event), 'bad')).rejects.toMatchObject({ status: 400 });
    expect(await s.billing.can(s.userId, 'full_certificate')).toBe(false);
    expect(await send(s.billing,event)).toEqual({ received: true });
    expect(await s.billing.can(s.userId, 'start_case:weekly')).toBe(true);
    expect(await send(s.billing,event)).toEqual({ received: true });
    expect((await fixture.db.query('SELECT id FROM billing_webhook_events WHERE id=$1', [event.id])).rows).toHaveLength(1);
  });

  it('revokes past-due and deleted subscriptions and ignores older regrant events', async () => {
    const s = await setup(); const { sub } = await activate(s);
    sub.status = 'past_due';
    await send(s.billing, { id: `evt_${randomUUID()}`, type: 'customer.subscription.updated', created: 200, livemode: false, subscriptionId: sub.id });
    expect(await s.billing.can(s.userId, 'full_certificate')).toBe(false);
    sub.status = 'active';
    await send(s.billing, { id: `evt_${randomUUID()}`, type: 'customer.subscription.updated', created: 199, livemode: false, subscriptionId: sub.id });
    expect(await s.billing.can(s.userId, 'full_certificate')).toBe(false);
    await send(s.billing, { id: `evt_${randomUUID()}`, type: 'customer.subscription.updated', created: 200, livemode: false, subscriptionId: sub.id });
    expect(await s.billing.can(s.userId, 'full_certificate')).toBe(false);
    sub.status = 'canceled';
    await send(s.billing, { id: `evt_${randomUUID()}`, type: 'customer.subscription.deleted', created: 201, livemode: false, subscriptionId: sub.id });
    expect(await s.billing.can(s.userId, 'full_certificate')).toBe(false);
  });

  it('does not grant expired, unknown-price or owner-mismatched subscriptions', async () => {
    for (const scenario of ['expired', 'price', 'owner', 'live']) {
      const s = await setup();
      await s.billing.checkout(s.userId, 'monthly');
      const sub: BillingSubscription = { id: `sub_${randomUUID()}`, customerId: `cus_${randomUUID()}`, userId: scenario === 'owner' ? randomUUID() : s.userId, status: 'active', priceIds: [scenario === 'price' ? 'price_wrong' : 'price_month'], periodEnd: new Date(instant.getTime() + (scenario === 'expired' ? -1 : 86400000)), livemode: scenario === 'live' };
      s.provider.subscriptions.set(sub.id, sub);
      await send(s.billing, { id: `evt_${randomUUID()}`, type: 'checkout.session.completed', created: 100, livemode: false, sessionId: s.provider.sessions[0].id, subscriptionId: sub.id, customerId: sub.customerId, userId: s.userId });
      expect(await s.billing.can(s.userId, 'full_certificate')).toBe(false);
    }
  });

  it('revokes a previously granted subscription when its price is no longer allowed', async () => {
    const s = await setup(); const { sub } = await activate(s);
    expect(await s.billing.can(s.userId,'full_certificate')).toBe(true);
    sub.priceIds = ['price_unrecognized'];
    await send(s.billing, { id: `evt_${randomUUID()}`, type: 'customer.subscription.updated', created: 200, livemode: false, subscriptionId: sub.id });
    expect(await s.billing.can(s.userId,'full_certificate')).toBe(false);
  });

  it('revokes an existing grant if the canonical owner changes or a deletion races a stale fetch', async () => {
    const s = await setup(); const { sub } = await activate(s);
    sub.userId = randomUUID();
    await send(s.billing, { id: `evt_${randomUUID()}`, type: 'customer.subscription.updated', created: 200, livemode: false, subscriptionId: sub.id });
    expect(await s.billing.can(s.userId, 'full_certificate')).toBe(false);
    sub.userId = s.userId;
    await send(s.billing, { id: `evt_${randomUUID()}`, type: 'customer.subscription.updated', created: 201, livemode: false, subscriptionId: sub.id });
    expect(await s.billing.can(s.userId, 'full_certificate')).toBe(true);
    // A deletion event cannot grant access even if the provider returns a stale active snapshot.
    await send(s.billing, { id: `evt_${randomUUID()}`, type: 'customer.subscription.deleted', created: 202, livemode: false, subscriptionId: sub.id });
    expect(await s.billing.can(s.userId, 'full_certificate')).toBe(false);
  });

  it('does not replace a current subscription with a stale second checkout at the same event timestamp', async () => {
    const s = await setup();
    await s.billing.checkout(s.userId, 'monthly');
    await s.billing.checkout(s.userId, 'yearly');
    const newer: BillingSubscription = { id: `sub_${randomUUID()}`, customerId: 'cus_shared', userId: s.userId, status: 'active', priceIds: ['price_year'], periodEnd: new Date(instant.getTime()+86400000), livemode: false };
    const older: BillingSubscription = { ...newer, id: `sub_${randomUUID()}`, priceIds: ['price_month'] };
    s.provider.subscriptions.set(newer.id,newer); s.provider.subscriptions.set(older.id,older);
    await send(s.billing, { id: `evt_${randomUUID()}`, type: 'checkout.session.completed', created: 100, livemode: false, sessionId: s.provider.sessions[1].id, subscriptionId: newer.id, customerId: newer.customerId, userId: s.userId });
    await send(s.billing, { id: `evt_${randomUUID()}`, type: 'checkout.session.completed', created: 100, livemode: false, sessionId: s.provider.sessions[0].id, subscriptionId: older.id, customerId: older.customerId, userId: s.userId });
    const row = (await fixture.db.query('SELECT stripe_subscription_id FROM subscriptions WHERE user_id=$1',[s.userId])).rows[0];
    expect(row.stripe_subscription_id).toBe(newer.id);
  });

  it('asks Stripe to retry when checkout completion arrives before the local session is saved', async () => {
    const s = await setup();
    const sub: BillingSubscription = { id: `sub_${randomUUID()}`, customerId: `cus_${randomUUID()}`, userId: s.userId, status: 'active', priceIds: ['price_month'], periodEnd: new Date(instant.getTime()+86400000), livemode: false };
    s.provider.subscriptions.set(sub.id,sub);
    const event: BillingEvent = { id: `evt_${randomUUID()}`, type: 'checkout.session.completed', created: 100, livemode: false, sessionId: `cs_${randomUUID()}`, subscriptionId: sub.id, customerId: sub.customerId, userId: s.userId };
    await expect(send(s.billing,event)).rejects.toMatchObject({ status: 503 });
    await fixture.db.query('INSERT INTO billing_checkout_sessions(session_id,user_id,price_id) VALUES($1,$2,$3)', [event.sessionId,s.userId,'price_month']);
    expect(await send(s.billing,event)).toEqual({ received: true });
    expect(await s.billing.can(s.userId,'full_certificate')).toBe(true);
  });

  it('treats a permanently failed generation job as unused and never upgrades a guest', async () => {
    const s = await setup(true);
    const caseId = randomUUID();
    await fixture.db.query("INSERT INTO cases(id,user_id,field,subfield,type,workspace,status,created_at) VALUES($1,$2,'sales','sdr_outbound','daily','chat','generating',$3)", [caseId,s.userId,instant]);
    await fixture.db.query("INSERT INTO jobs(kind,case_id,dedupe_key,payload,status) VALUES('case.generate',$1,$2,'{}','failed')",[caseId,randomUUID()]);
    expect(await s.billing.can(s.userId, 'start_case:daily')).toBe(true);
    await fixture.db.query('UPDATE cases SET started_at=$2 WHERE id=$1',[caseId,instant]);
    expect(await s.billing.can(s.userId, 'start_case:daily')).toBe(false);
    await fixture.db.query("INSERT INTO subscriptions(user_id,status,current_period_end) VALUES($1,'pro',$2)",[s.userId,new Date(instant.getTime()+86400000)]);
    expect(await s.billing.can(s.userId, 'full_certificate')).toBe(false);
    expect(await s.billing.can(s.userId, 'start_case:weekly')).toBe(false);
  });

  it('gives guests Pro entitlements in jury demo mode without letting them manage billing', async () => {
    const guest = await setup(true);
    const demo = createBillingService({ db: fixture.db, provider: createStripeProvider({}), appUrl: 'http://localhost:3000', monthlyPriceId: 'price_test_monthly', guestPro: true });
    expect(await demo.can(guest.userId, 'start_case:weekly')).toBe(true);
    expect(await demo.can(guest.userId, 'practice_retake')).toBe(true);
    expect((await demo.summary(guest.userId)).plan).toBe('pro');
    await expect(demo.checkout(guest.userId, 'monthly')).rejects.toMatchObject({ status: 403 });
    const member = await setup();
    expect(await demo.can(member.userId, 'start_case:weekly')).toBe(false);
  });

  it('keeps configuration optional until a checkout or webhook needs it', async () => {
    const s = await setup();
    const disabled = createBillingService({ db: fixture.db, provider: createStripeProvider({}), appUrl: 'http://localhost:3000' });
    expect(await disabled.can(s.userId, 'start_case:onboarding')).toBe(true);
    await expect(disabled.checkout(s.userId, 'monthly')).rejects.toMatchObject({ status: 503 });
    await expect(disabled.handleWebhook('{}','sig')).rejects.toMatchObject({ status: 503 });
  });
});

describe('Stripe SDK webhook verification', () => {
  it('checks the raw payload signature and rejects modified bodies', () => {
    const secret = 'whsec_test_example';
    const stripe = new Stripe('sk_test_example');
    const raw = JSON.stringify({ id: 'evt_signed', object: 'event', created: 123, livemode: false, type: 'customer.subscription.updated', data: { object: { id: 'sub_signed' } } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload: raw, secret });
    const provider = createStripeProvider({ secretKey: 'sk_test_example', webhookSecret: secret });
    expect(provider.constructEvent(raw, signature)).toMatchObject({ id: 'evt_signed', subscriptionId: 'sub_signed' });
    expect(() => provider.constructEvent(raw + ' ', signature)).toThrow();
  });
  it('extracts the checkout owner and customer from the signed session', () => {
    const secret = 'whsec_test_example';
    const stripe = new Stripe('sk_test_example');
    const raw = JSON.stringify({ id: 'evt_checkout', object: 'event', created: 123, livemode: false, type: 'checkout.session.completed', data: { object: { id: 'cs_123', customer: 'cus_123', subscription: 'sub_123', metadata: { userId: 'owner-id' } } } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload: raw, secret });
    const provider = createStripeProvider({ secretKey: 'sk_test_example', webhookSecret: secret });
    expect(provider.constructEvent(raw,signature)).toMatchObject({ sessionId: 'cs_123', customerId: 'cus_123', subscriptionId: 'sub_123', userId: 'owner-id' });
  });
});
