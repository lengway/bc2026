import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { readConfig } from '@/modules/config';
import { createCatalogService } from '@/modules/catalog';
import { MockProvider } from '@/modules/llm';
import { createCoreRuntime } from '@/modules/runtime';
import { createIdentityService } from '@/modules/identity';
import { createApi } from '../../src/app/api/_lib/handlers';
import { createWorker } from '../../src/worker/runner';
import { createTestDatabase } from './db-helper';

let state: Awaited<ReturnType<typeof createTestDatabase>>;
beforeEach(async () => { state = await createTestDatabase(); });
afterEach(async () => { await state?.cleanup(); });
const origin = 'https://gambit.example';
const day = 86_400_000;

it.each(['magic link','password'])('keeps the same %s member after generating, submitting, and attempting a forbidden operation', async mode => {
  let link = '';
  const demo = await createCatalogService().getDemoCase('sales', 'sdr_outbound');
  const app = createCoreRuntime(readConfig({ APP_URL: origin, DATABASE_URL: 'unused', LLM_MODEL: 'test', OPENAI_API_KEY: 'unused', SMTP_HOST: 'unused', SMTP_FROM: 'a@example.com' }), {
    db: state.db, mailer: { async sendMagicLink(_email, url) { link = url; },async sendAccountMail(_email,_purpose,url){link=url!;} },
    provider: new MockProvider({
      'intake.parse': [JSON.stringify({ subfield: 'sdr_outbound', years: 1, pains: ['Discovery'], goals: ['Qualify leads'] })],
      'case.generate': [JSON.stringify({ brief: demo.case.brief, docs: demo.case.docs, personas: demo.personas })],
      'case.rubric': [JSON.stringify(demo.rubric)],
    }),
  });
  const api = createApi(app);
  let cookie = '';
  const request = (path: string, method = 'GET', data?: unknown) => new Request(`${origin}${path}`, {
    method, headers: { origin, cookie, 'Content-Type': 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const email=`${randomUUID()}@example.com`;
  if(mode==='magic link') {
    await api.magicLink(request('/api/auth/magic-link', 'POST', { email }));
    const verified = await api.verify(new Request(link));
    expect(verified.status).toBe(303);
    cookie = verified.headers.get('set-cookie')!.split(';')[0];
  } else {
    const password='session continuity password';
    expect((await api.register(request('/api/auth/register','POST',{email,password,displayName:'Jordan Doe'}))).status).toBe(202);
    const verified=await api.verifyEmail(request('/api/auth/verify-email','POST',{token:new URL(link).searchParams.get('token')}));
    expect(verified.status).toBe(200);
    cookie=verified.headers.get('set-cookie')!.split(';')[0];
    const login=await api.login(request('/api/auth/login','POST',{email,password}));
    expect(login.status).toBe(200);
    cookie=login.headers.get('set-cookie')!.split(';')[0];
  }
  const before = await (await api.session(request('/api/auth/session'))).json();
  expect(before.user.isGuest).toBe(false);
  expect((await api.intake(request('/api/intake', 'POST', { field: 'sales', level: 'beginner', text: 'I am a new SDR.' }))).status).toBe(200);
  const generated = await api.generateCase(request('/api/cases', 'POST', { type: 'onboarding' }));
  expect(generated.status).toBe(202);
  const id = (await generated.json()).caseId;
  await createWorker({ jobs: app.jobs, handlers: { 'case.generate': app.caseEngine.handleGenerateJob, 'case.evaluate': app.evaluation.handleEvaluateJob } }).runOnce();
  const context = { params: Promise.resolve({ id }) };
  expect((await api.start(request(`/api/cases/${id}/start`, 'POST', {}), context)).status).toBe(200);
  expect((await api.submit(request(`/api/cases/${id}/submit`, 'POST', {}), context)).status).toBe(202);
  expect((await api.generateCase(request('/api/cases', 'POST', { type: 'weekly' }))).status).toBe(403);
  expect(await (await api.session(request('/api/auth/session'))).json()).toEqual(before);
  if(mode==='password') {
    const recorded=await state.db.query("SELECT user_id FROM llm_calls WHERE user_id=$1 AND prompt_id='intake.parse'",[before.user.id]);
    expect(recorded.rows).toHaveLength(1);
    expect((await api.deleteAccount(request('/api/account','DELETE',{confirm:'DELETE',currentPassword:'session continuity password'}))).status).toBe(200);
    expect((await state.db.query('SELECT id FROM llm_calls WHERE user_id=$1 OR case_id=$2',[before.user.id,id])).rows).toHaveLength(0);
  }
});

it('extends an active member at half-life and sends the new expiry back in the HTTP cookie', async () => {
  let at = new Date('2026-11-14T12:00:00Z');
  let link = '';
  const app = createCoreRuntime(readConfig({ APP_URL: origin, DATABASE_URL: 'unused', LLM_MODEL: 'test', OPENAI_API_KEY: 'unused', SMTP_HOST: 'unused', SMTP_FROM: 'a@example.com' }), {
    db: state.db, now: () => at, mailer: { async sendMagicLink(_email, url) { link = url; } }, provider: new MockProvider({}),
  });
  await app.identity.requestMagicLink(`${randomUUID()}@example.com`, randomUUID());
  const member = await app.identity.consumeMagicLink(new URL(link).searchParams.get('token')!);
  const api = createApi(app);
  const cookie = `skills_session=${member.token}`;
  at = new Date(at.getTime() + 16 * day);
  const response = await api.session(new Request(`${origin}/api/auth/session`, { headers: { cookie } }));
  const session = await response.json();
  expect(session.expiresAt).toBe('2026-12-30T12:00:00.000Z');
  expect(response.headers.get('set-cookie')).toContain('Expires=Wed, 30 Dec 2026 12:00:00 GMT');
  expect(response.headers.get('set-cookie')).toContain('Max-Age=2592000');
  at = new Date(at.getTime() + 15 * day);
  expect((await app.identity.getSession(member.token))?.user.id).toBe(member.session!.user.id);
});

it('does not extend guest sessions or resurrect revoked members', async () => {
  let at = new Date('2026-11-14T12:00:00Z');
  const identity = createIdentityService({ db: state.db, appUrl: origin, now: () => at, guestAccessEnabled: true, mailer: { async sendMagicLink() {} } });
  const guest = await identity.createGuestSession(randomUUID());
  at = new Date(at.getTime() + 23 * 3_600_000);
  expect((await identity.getSession(guest.token))?.expiresAt).toBe(guest.session!.expiresAt);
  at = new Date(at.getTime() + 3_600_000);
  expect(await identity.getSession(guest.token)).toBeNull();
});
