import { z } from 'zod';
import type { BillingSummary } from '@/contracts';
import type { Database, SqlExecutor } from '@/modules/database';
import { AppError, systemClock, type Clock } from '@/modules/shared';
import { BillingEvent, BillingSubscription, type BillingProvider } from './provider';
import { bindSubscription, eventProcessed, getBinding, getCheckout, getUser, hasRecentDaily, rememberEvent, saveCheckout, saveSubscription } from './repo';

export { createStripeProvider, type BillingProvider, type BillingEvent, type BillingSubscription } from './provider';
export const BillingAction = z.enum(['start_case:onboarding','start_case:daily','start_case:weekly','full_certificate']);
export type BillingAction = z.infer<typeof BillingAction>;
export type BillingPlan = 'monthly' | 'yearly';
export interface BillingDeps { db: Database; provider: BillingProvider; appUrl: string; monthlyPriceId?: string; yearlyPriceId?: string; now?: Clock }
const isPro = (user: Awaited<ReturnType<typeof getUser>>, now: Date) => !user.isGuest && user.status === 'pro' && user.periodEnd !== null && user.periodEnd > now;
const availableError = () => new AppError('VALIDATION',503,'Billing is temporarily unavailable.');

export function createBillingService({ db, provider, appUrl, monthlyPriceId, yearlyPriceId, now = systemClock }: BillingDeps) {
  const freeQuotaUsed = (executor: SqlExecutor, userId: string, at: Date) =>
    hasRecentDaily(executor,userId,new Date(at.getTime() - 7 * 86400000));
  async function summary(userId: string): Promise<BillingSummary> {
    const user = await getUser(db,userId), at = now();
    const pro = isPro(user,at);
    return {
      plan: pro ? 'pro' : 'free',
      periodEnd: user.periodEnd?.toISOString() ?? null,
      freeDailyRemaining: pro || await freeQuotaUsed(db,userId,at) ? 0 : 1,
      canManage: !user.isGuest && !!user.customerId,
    };
  }
  async function portal(userId: string): Promise<{ url: string }> {
    const user = await getUser(db,userId);
    if (user.isGuest) throw new AppError('FORBIDDEN',403,'Sign in to manage a subscription.');
    if (!user.customerId) throw new AppError('NOT_FOUND',404,'No subscription was found for this account.');
    try {
      const result = await provider.createPortal({ customerId: user.customerId, returnUrl: new URL('/settings/billing',appUrl).href });
      return z.object({url:z.url({protocol:/^https$/})}).parse(result);
    } catch { throw availableError(); }
  }
  async function can(userId: string, action: BillingAction, executor: SqlExecutor = db): Promise<boolean> {
    if (!z.uuid().safeParse(userId).success || !BillingAction.safeParse(action).success) throw new AppError('VALIDATION',400,'Invalid billing request.');
    const user = await getUser(executor,userId);
    const instant = now();
    if (action === 'start_case:onboarding') return true;
    if (isPro(user,instant)) return true;
    if (action !== 'start_case:daily') return false;
    return !await freeQuotaUsed(executor,userId,instant);
  }
  async function checkout(userId: string, plan: BillingPlan): Promise<{ url: string }> {
    if (!z.uuid().safeParse(userId).success || !z.enum(['monthly','yearly']).safeParse(plan).success) throw new AppError('VALIDATION',400,'Invalid checkout request.');
    const priceId = plan === 'monthly' ? monthlyPriceId : yearlyPriceId;
    if (!priceId) throw availableError();
    const user = await getUser(db,userId);
    if (user.isGuest) throw new AppError('FORBIDDEN',403,'Sign in before starting checkout.');
    if (isPro(user,now())) throw new AppError('VALIDATION',409,'An active subscription already exists.');
    const origin = new URL(appUrl).origin;
    let session: { id: string; url: string };
    try { session = await provider.createCheckout({ userId,priceId,successUrl: `${origin}/?checkout=success`,cancelUrl: `${origin}/?checkout=cancelled`,customerId: user.customerId ?? undefined }); }
    catch (error) { if (error instanceof AppError) throw error; throw availableError(); }
    const parsed = z.object({ id: z.string().min(1), url: z.url({ protocol: /^https$/ }) }).safeParse(session);
    if (!parsed.success) throw availableError();
    await saveCheckout(db,parsed.data.id,userId,priceId,now());
    return { url: parsed.data.url };
  }
  async function handleWebhook(rawBody: string, signature: string): Promise<{ received: true }> {
    let event: BillingEvent;
    try { event = BillingEvent.parse(provider.constructEvent(rawBody,signature)); }
    catch (error) { if (error instanceof AppError && error.status === 503) throw error; throw new AppError('VALIDATION',400,'Invalid webhook signature or payload.'); }
    if (event.livemode) throw new AppError('VALIDATION',400,'Live billing events are not accepted.');
    if (await eventProcessed(db,event.id)) return { received: true };
    const checkoutEvent = event.type === 'checkout.session.completed';
    const subscriptionEvent = ['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type);
    if (!checkoutEvent && !subscriptionEvent) {
      await rememberEvent(db,event,now());
      return { received: true };
    }
    if (!monthlyPriceId && !yearlyPriceId) throw availableError();
    if (!event.subscriptionId || (checkoutEvent && (!event.sessionId || !event.customerId || !event.userId))) throw new AppError('VALIDATION',400,'Invalid webhook payload.');
    const checkoutInfo = checkoutEvent ? await getCheckout(db,event.sessionId!) : null;
    if (checkoutEvent && !checkoutInfo) throw availableError(); // A webhook may race the local checkout-session insert.
    const binding = await getBinding(db,event.subscriptionId);
    if (subscriptionEvent && !binding) throw availableError(); // Stripe retries when subscription events arrive before checkout completion.
    let canonical: BillingSubscription;
    try { canonical = BillingSubscription.parse(await provider.retrieveSubscription(event.subscriptionId)); }
    catch { throw availableError(); }
    const userId = checkoutInfo?.userId ?? binding?.userId;
    if (!userId) throw availableError();
    const subscriptionId = event.subscriptionId;
    await db.transaction(async (tx) => {
      const user = await getUser(tx,userId,true);
      if (!await rememberEvent(tx,event,now())) return;
      const matches = canonical.id === subscriptionId && !canonical.livemode && canonical.userId === userId && !user.isGuest &&
        (!user.customerId || user.customerId === canonical.customerId) &&
        (!binding || (binding.userId === userId && binding.customerId === canonical.customerId)) &&
        (!checkoutEvent || (checkoutInfo !== null && event.userId === userId && event.customerId === canonical.customerId));
      if (!matches) {
        // A previously bound subscription whose canonical ownership changes must lose its grant;
        // never transfer that grant to the metadata's new owner.
        if (subscriptionEvent && binding && user.subscriptionId === subscriptionId && canonical.id === subscriptionId &&
            user.customerId && user.periodEnd && event.created >= (user.lastEventCreated ?? -1)) {
          await saveSubscription(tx,{ userId,customerId: user.customerId,subscriptionId,pro: false,periodEnd: user.periodEnd,eventCreated: event.created,now: now() });
        }
        return;
      }
      if (checkoutEvent && !binding) await bindSubscription(tx,subscriptionId,userId,canonical.customerId,event.sessionId!,now());
      const actualBinding = await getBinding(tx,subscriptionId);
      if (!actualBinding || actualBinding.userId !== userId || actualBinding.customerId !== canonical.customerId) return;
      // An old subscription event can never replace a newer checkout association.
      if (!checkoutEvent && user.subscriptionId && user.subscriptionId !== subscriptionId) return;
      // Competing checkout sessions cannot replace an active subscription, or win a timestamp tie.
      if (checkoutEvent && user.subscriptionId && user.subscriptionId !== subscriptionId &&
          (isPro(user,now()) || event.created <= (user.lastEventCreated ?? -1))) return;
      const pro = event.type !== 'customer.subscription.deleted' && canonical.status === 'active' && canonical.periodEnd > now() && canonical.priceIds.length === 1 &&
        canonical.priceIds.some((id) => id === monthlyPriceId || id === yearlyPriceId) &&
        (!checkoutEvent || canonical.priceIds[0] === checkoutInfo?.priceId);
      // Stripe timestamps have one-second resolution. At an equal timestamp a denial wins;
      // an active snapshot cannot regrant until a later event.
      const watermark = user.lastEventCreated ?? -1;
      if (event.created < watermark || (event.created === watermark && pro && !isPro(user,now()))) return;
      await saveSubscription(tx,{ userId,customerId: canonical.customerId,subscriptionId,pro,periodEnd: canonical.periodEnd,eventCreated: event.created,now: now() });
    });
    return { received: true };
  }
  return { can, summary, portal, checkout, createCheckout: checkout, handleWebhook };
}
export type BillingService = ReturnType<typeof createBillingService>;
