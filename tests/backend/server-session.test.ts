import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readConfig } from '@/modules/config';
import { MockProvider } from '@/modules/llm';
import { createCoreRuntime, type CoreRuntime } from '@/modules/runtime';
import { createTestDatabase } from './db-helper';

let app: CoreRuntime, cookie = '';
vi.mock('@/modules/runtime', async importOriginal => ({ ...await importOriginal<typeof import('@/modules/runtime')>(), getRuntime: () => app }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ toString: () => cookie }) }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error('REDIRECT:'+url); } }));
import { proxy } from '../../src/proxy';
import { requireUser } from '../../src/app/_lib/auth/server';

let state: Awaited<ReturnType<typeof createTestDatabase>>;
const origin = 'https://gambit.example';
beforeAll(async () => {
  state = await createTestDatabase();
  let link = '';
  app = createCoreRuntime(readConfig({ APP_URL: origin, DATABASE_URL: 'unused', LLM_MODEL: 'test', OPENAI_API_KEY: 'unused', SMTP_HOST: 'unused', SMTP_FROM: 'test@example.com' }), {
    db: state.db, provider: new MockProvider({}), mailer: { async sendMagicLink(_email, url) { link = url; } },
  });
  await app.identity.requestMagicLink(`${randomUUID()}@example.com`, randomUUID());
  const member = await app.identity.consumeMagicLink(new URL(link).searchParams.get('token')!);
  cookie = `skills_session=${member.token}`;
  vi.stubEnv('APP_URL', origin);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
afterAll(async () => { vi.unstubAllEnvs(); await state?.cleanup(); });

it('keeps a real valid cookie on review navigation even if the public self-fetch is unreachable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Cloudflare/origin unavailable')));
  const result = await proxy(new NextRequest(origin+'/review/'+randomUUID(), { headers: { cookie } }));
  expect(result.status).toBe(200);
  expect(result.headers.get('location')).toBeNull();
  await expect(requireUser()).resolves.toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
});
it('returns a service error rather than a login redirect when session storage fails', async () => {
  vi.spyOn(app.identity, 'getSession').mockRejectedValue(new Error('Database unavailable'));
  const result = await proxy(new NextRequest(origin+'/review/'+randomUUID(), { headers: { cookie } }));
  expect(result.status).toBe(503);
  expect(result.headers.get('location')).toBeNull();
  expect(result.headers.get('set-cookie')).toBeNull();
  await expect(requireUser()).rejects.toThrow('Database unavailable');
});
it('still redirects an actually missing or expired session to login', async () => {
  const result = await proxy(new NextRequest(origin+'/dashboard'));
  expect(result.status).toBe(307);
  expect(result.headers.get('location')).toBe(origin+'/login?next=%2Fdashboard');
});
