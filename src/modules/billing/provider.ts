import Stripe from 'stripe';
import { z } from 'zod';
import { AppError } from '@/modules/shared';

export const BillingEvent = z.object({ id: z.string().min(1), type: z.string().min(1), created: z.int().nonnegative(), livemode: z.boolean(), subscriptionId: z.string().min(1).optional(), sessionId: z.string().min(1).optional(), customerId: z.string().min(1).optional(), userId: z.string().optional() });
export type BillingEvent = z.infer<typeof BillingEvent>;
export const BillingSubscription = z.object({ id: z.string().min(1), customerId: z.string().min(1), userId: z.string().optional(), status: z.string().min(1), priceIds: z.array(z.string().min(1)), periodEnd: z.date(), livemode: z.boolean() });
export type BillingSubscription = z.infer<typeof BillingSubscription>;
export interface BillingProvider {
  constructEvent(rawBody: string, signature: string): BillingEvent;
  createCheckout(input: { userId: string; priceId: string; successUrl: string; cancelUrl: string; customerId?: string }): Promise<{ id: string; url: string }>;
  retrieveSubscription(id: string): Promise<BillingSubscription>;
}
const disabled = () => new AppError('VALIDATION', 503, 'Billing is not configured.');
const idOf = (value: string | { id: string } | null): string | undefined => typeof value === 'string' ? value : value?.id;

/** The adapter accepts only test keys and does not create a client or contact Stripe at import time. */
export function createStripeProvider({ secretKey, webhookSecret }: { secretKey?: string; webhookSecret?: string }): BillingProvider {
  function client() {
    if (!secretKey?.startsWith('sk_test_')) throw disabled();
    return new Stripe(secretKey);
  }
  return {
    constructEvent(rawBody, signature) {
      if (!webhookSecret || !secretKey?.startsWith('sk_test_')) throw disabled();
      const event = client().webhooks.constructEvent(rawBody, signature, webhookSecret);
      const result: BillingEvent = { id: event.id, type: event.type, created: event.created, livemode: event.livemode };
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        result.sessionId = session.id;
        result.subscriptionId = idOf(session.subscription);
        result.customerId = idOf(session.customer);
        result.userId = session.metadata?.userId;
      } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
        result.subscriptionId = event.data.object.id;
      }
      return BillingEvent.parse(result);
    },
    async createCheckout(input) {
      const session = await client().checkout.sessions.create({ mode: 'subscription', line_items: [{ price: input.priceId, quantity: 1 }], customer: input.customerId, client_reference_id: input.userId, metadata: { userId: input.userId }, subscription_data: { metadata: { userId: input.userId } }, success_url: input.successUrl, cancel_url: input.cancelUrl });
      if (!session.url || session.livemode) throw new Error('Invalid test checkout session');
      return { id: session.id, url: session.url };
    },
    async retrieveSubscription(id) {
      const subscription = await client().subscriptions.retrieve(id);
      const items = subscription.items.data;
      if (!items.length || subscription.items.has_more) throw new Error('Incomplete subscription items');
      const periodEnd = Math.min(...items.map((item) => item.current_period_end));
      return BillingSubscription.parse({ id: subscription.id, customerId: idOf(subscription.customer), userId: subscription.metadata.userId, status: subscription.status, priceIds: items.map((item) => item.price.id), periodEnd: new Date(periodEnd * 1000), livemode: subscription.livemode });
    },
  };
}
