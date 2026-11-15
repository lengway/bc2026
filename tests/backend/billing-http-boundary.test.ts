import { expect, it, vi } from 'vitest';
import type { BillingProvider } from '@/modules/billing';
import type { Database } from '@/modules/database';
import type { CoreRuntime } from '@/modules/runtime';

// The HTTP handler can be exercised with a session and a query stub, without a native password library or database.
vi.mock('@/modules/identity/password', () => ({ hashPassword: vi.fn(), verifyPassword: vi.fn() }));

const origin = 'https://skills.example';
const userId = '123e4567-e89b-42d3-a456-426614174000';
const user = { id: userId, isGuest: false, status: 'free', customerId: 'cus_test', subscriptionId: null, periodEnd: null, lastEventCreated: null };

function runtime(billing: CoreRuntime['billing']) {
  return {
    config: { APP_URL: origin }, billing,
    identity: { getSession: async () => ({ user, expiresAt: '2027-01-01T00:00:00.000Z' }) },
    now: () => new Date('2026-11-15T00:00:00.000Z'),
  } as unknown as CoreRuntime;
}

function fixture(error: Error) {
  const db: Database = {
    query: vi.fn(async () => ({ rows: [user], rowCount: 1 })),
    async transaction(work) { return work(db); },
    async close() {},
  };
  const provider: BillingProvider = {
    createCheckout: vi.fn(async () => { throw error; }),
    createPortal: vi.fn(async () => { throw error; }),
    constructEvent: vi.fn(), retrieveSubscription: vi.fn(),
  };
  return { db, provider, appUrl: origin, monthlyPriceId: 'price_test' };
}

function request(action: 'checkout' | 'portal') {
  return new Request(`${origin}/api/billing/${action}`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', cookie: `skills_session=${'k'.repeat(43)}` },
    body: JSON.stringify(action === 'checkout' ? { plan: 'monthly' } : {}),
  });
}

it('preserves Stripe failure status when runtime and route modules load separate AppError constructors', async () => {
  const { createBillingService } = await import('@/modules/billing');
  const { AppError: RuntimeAppError } = await import('@/modules/shared');
  const billing = createBillingService(fixture(new Error('Stripe rejected the tax configuration')));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});

  // The runtime singleton can be reused by standalone route chunks with a different constructor identity.
  vi.resetModules();
  const { AppError: RouteAppError } = await import('@/modules/shared');
  expect(RouteAppError).not.toBe(RuntimeAppError);
  const { createApi } = await import('../../src/app/api/_lib/handlers');
  const response = await createApi(runtime(billing)).checkout(request('checkout'));

  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: { code: 'VALIDATION', message: 'Billing is temporarily unavailable.' } });
  expect(log).not.toHaveBeenCalledWith('API_REQUEST_FAILED');
});

it.each(['checkout', 'portal'] as const)('logs bounded, redacted Stripe diagnostics for %s', async (action) => {
  const { createBillingService } = await import('@/modules/billing');
  const { createApi } = await import('../../src/app/api/_lib/handlers');
  const error = Object.assign(
    new Error(`Failed for customer@private.invalid with sk_test_SampleSecret whsec_SampleSecret and csrf_token=abc123. Payment references tok_visa ctoken_demo.\nCookie: session=never-print-this\nAuthorization: Bearer secret-bearer\nRequest body: private body inline\n${'Extra detail '.repeat(40)}`),
    { name: 'StripeInvalidRequestError', type: 'StripeInvalidRequestError', code: 'parameter_invalid_empty', statusCode: 400, raw: { body: 'private payload' } },
  );
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const api = createApi(runtime(createBillingService(fixture(error))));
  const response = await (action === 'checkout' ? api.checkout(request(action)) : api.billingPortal(request(action)));

  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: { code: 'VALIDATION', message: 'Billing is temporarily unavailable.' } });
  expect(log).toHaveBeenCalledWith('BILLING_PROVIDER_FAILED', expect.objectContaining({
    operation: action, name: 'StripeInvalidRequestError', type: 'StripeInvalidRequestError', code: 'parameter_invalid_empty', status: 400,
  }));
  expect(log.mock.calls[0][1].message).toContain('Failed for');
  expect(log.mock.calls[0][1].message).toContain('[redacted]');
  expect(log.mock.calls[0][1].message.length).toBeLessThanOrEqual(200);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/customer@|SampleSecret|abc123|tok_visa|ctoken_demo|never-print-this|secret-bearer|private body inline|private payload/);
});
