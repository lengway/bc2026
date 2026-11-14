import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { readConfig } from '@/modules/config';
import { MockProvider } from '@/modules/llm';
import { createCoreRuntime } from '@/modules/runtime';
import { createApi } from '../../src/app/api/_lib/handlers';
import { createTestDatabase } from './db-helper';

let state: Awaited<ReturnType<typeof createTestDatabase>>;
const origin = 'https://gambit.example';
const sent: { purpose: string; url: string | null }[] = [];
let api: ReturnType<typeof createApi>;
beforeAll(async () => {
  state = await createTestDatabase();
  api = createApi(createCoreRuntime(readConfig({ APP_URL: origin, DATABASE_URL: 'unused', LLM_MODEL: 'test', OPENAI_API_KEY: 'unused', SMTP_HOST: 'unused', SMTP_FROM: 'test@example.com' }), {
    db: state.db, provider: new MockProvider({}), mailer: {
      async sendMagicLink(_email, url) { sent.push({ purpose: 'magic_link', url }); },
      async sendAccountMail(_email, purpose, url) { sent.push({ purpose, url }); },
    },
  }));
});
afterAll(async () => { await state?.cleanup(); });
const req = (path: string, data?: unknown, cookie = '', method = 'POST', extra: HeadersInit = {}) => new Request(origin+path, {
  method, headers: { origin, cookie, 'Content-Type': 'application/json', ...Object.fromEntries(new Headers(extra)) },
  ...(data === undefined ? {} : { body: JSON.stringify(data) }),
});
it('exposes cookie-based account HTTP endpoints without returning raw tokens or hashes', async () => {
  expect(api.register).toBeTypeOf('function');
  const email = `${randomUUID()}@example.com`, password = 'correct horse battery';
  const registration = await api.register(req('/api/auth/register', { email, password, displayName: 'Jordan Doe' }));
  expect(registration.status).toBe(202);
  expect(await registration.json()).toEqual({ accepted: true });
  const login = await api.login(req('/api/auth/login', { email, password, next: '/review/123?tab=moves' }));
  expect(login.status).toBe(200);
  const raw = await login.text();
  expect(raw).not.toMatch(/password_hash|token_hash|"token"|correct horse/);
  expect(JSON.parse(raw)).toMatchObject({ next: '/review/123?tab=moves', session: { user: { emailVerified: false } } });
  const setCookie = login.headers.get('set-cookie')!;
  expect(setCookie).toContain('HttpOnly'); expect(setCookie).toContain('Secure');
  expect(Number(/Max-Age=(\d+)/.exec(setCookie)?.[1])).toBeGreaterThanOrEqual(2_591_998);
  expect(Number(/Max-Age=(\d+)/.exec(setCookie)?.[1])).toBeLessThanOrEqual(2_592_000);
  let cookie = setCookie.split(';')[0];
  const token = new URL(sent[0].url!).searchParams.get('token');
  const verified=await api.verifyEmail(req('/api/auth/verify-email', { token }, cookie));
  expect(verified.status).toBe(200);
  expect(await verified.json()).toEqual({ok:true});
  cookie=verified.headers.get('set-cookie')!.split(';')[0];
  expect(await (await api.session(req('/api/auth/session', undefined, cookie, 'GET'))).json()).toMatchObject({ user: { emailVerified: true } });
  const updated = await api.updateAccount(req('/api/account', { displayName: 'Jordan Smith' }, cookie, 'PATCH'));
  expect(await updated.json()).toMatchObject({ displayName: 'Jordan Smith' });
  const rotated = await api.login(req('/api/auth/login', { email, password, next: '//attacker.example' }, cookie));
  expect((await rotated.json()).next).toBe('/onboarding');
  expect(await (await api.session(req('/api/auth/session', undefined, cookie, 'GET'))).json()).toBeNull();
  const newCookie = rotated.headers.get('set-cookie')!.split(';')[0];
  expect((await api.logoutAll(req('/api/auth/logout-all', {}, newCookie))).headers.get('set-cookie')).toContain('Max-Age=0');
  expect(await (await api.session(req('/api/auth/session', undefined, newCookie, 'GET'))).json()).toBeNull();
});

it('rejects cross-origin and non-JSON account mutations and does not emit a clearing cookie for authorization errors', async () => {
  for (const handler of [api.register, api.login, api.forgotPassword, api.resetPassword, api.verifyEmail, api.changePassword, api.changeEmail, api.logoutAll, api.updateAccount, api.deleteAccount]) {
    expect((await handler(req('/api/auth/test', {}, '', 'POST', { origin: 'https://attacker.example' }))).status).toBe(403);
    expect((await handler(req('/api/auth/test', {}, '', 'POST', { 'Content-Type': 'text/plain' }))).status).toBe(415);
  }
  const denied = await api.getAccount(req('/api/account', undefined, '', 'GET'));
  expect(denied.status).toBe(401);
  expect(denied.headers.get('set-cookie')).toBeNull();
});

it('preserves a safe return path in a single-use magic link', async () => {
  const response = await api.magicLink(req('/api/auth/magic-link', { email: `${randomUUID()}@example.com`, next: '/settings' }));
  expect(response.status).toBe(202);
  const verify = await api.verify(new Request(sent.at(-1)!.url!));
  expect(verify.headers.get('location')).toBe(origin+'/settings');
});
