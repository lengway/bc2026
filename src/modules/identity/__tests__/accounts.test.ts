import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createTestDatabase } from '../../../../tests/backend/db-helper';
import { createIdentityService, hashToken } from '../index';

let state: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { state = await createTestDatabase(); });
afterAll(async () => { await state?.cleanup(); });
const password = 'a strong test password 48';
function setup() {
  let at = new Date();
  const sent: { email: string; purpose: string; url: string | null }[] = [];
  const service = createIdentityService({ db: state.db, appUrl: 'https://gambit.example', now: () => at,
    mailer: {
      async sendMagicLink(email, url) { sent.push({ email, purpose: 'magic_link', url }); },
      async sendAccountMail(email: string, purpose: string, url: string | null) { sent.push({ email, purpose, url }); },
    },
  });
  const email = `${randomUUID()}@example.com`;
  return { service, sent, email, advance: (ms: number) => { at = new Date(at.getTime() + ms); } };
}
const extract = (mail: { url: string | null }) => new URL(mail.url!).searchParams.get('token')!;

it('registers a member, stores Argon2id, permits unverified practice login, and verifies email once', async () => {
  const { service, sent, email } = setup();
  expect(service.register).toBeTypeOf('function');
  expect(await service.register({ email, password, displayName: 'Jordan Reyes' }, randomUUID())).toEqual({ accepted: true });
  const login = await service.login({ email: email.toUpperCase(), password }, randomUUID());
  expect(login.session.user).toMatchObject({ displayName: 'Jordan Reyes', isGuest: false, emailVerified: false });
  const row = (await state.db.query('SELECT password_hash FROM users WHERE email=$1', [email])).rows[0];
  expect(row.password_hash).toMatch(/^\$argon2id\$/);
  expect(JSON.stringify(login.session)).not.toMatch(/password_hash|token_hash|password/);
  const token = extract(sent[0]);
  expect((await state.db.query('SELECT token_hash FROM auth_tokens WHERE token_hash=$1', [hashToken(token)])).rows).toHaveLength(1);
  const verified=await service.verifyEmail(token);
  expect(await service.getSession(login.token)).toBeNull();
  expect((await service.getSession(verified.token))?.user.emailVerified).toBe(true);
  await expect(service.verifyEmail(token)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
});

it('does not overwrite existing credentials or reveal account existence on registration/reset', async () => {
  const { service, email } = setup();
  const input = { email, password, displayName: 'Jordan' };
  const first = await service.register(input, randomUUID());
  expect(await service.register({ ...input, password: 'attacker password 123', displayName: 'Attacker' }, randomUUID())).toEqual(first);
  expect((await service.login({ email, password }, randomUUID())).session.user.displayName).toBe('Jordan');
  expect(await service.forgotPassword(email, randomUUID())).toEqual(await service.forgotPassword(`${randomUUID()}@example.com`, randomUUID()));
  await expect(service.login({ email, password: 'incorrect password' }, randomUUID())).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Email or password is incorrect.' });
  await expect(service.login({ email: `${randomUUID()}@example.com`, password: 'incorrect password' }, randomUUID())).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Email or password is incorrect.' });
});

it('email confirmation activates the password from that registration, not an attacker pre-registration', async () => {
  const {service,email,sent}=setup();
  await service.register({email,password:'attacker chosen password',displayName:'Attacker'},randomUUID());
  const attacker=await service.login({email,password:'attacker chosen password'},randomUUID());
  await service.register({email,password,displayName:'Real owner'},randomUUID());
  await service.verifyEmail(extract(sent.at(-1)!));
  await expect(service.login({email,password:'attacker chosen password'},randomUUID())).rejects.toMatchObject({code:'UNAUTHORIZED'});
  expect((await service.login({email,password},randomUUID())).session.user.displayName).toBe('Real owner');
  expect(await service.getSession(attacker.token)).toBeNull();
});

it('a magic-link mailbox claim invalidates provisional passwords and pre-verification sessions', async () => {
  const {service,email,sent}=setup();
  await service.register({email,password,displayName:'Provisional'},randomUUID());
  const provisional=await service.login({email,password},randomUUID());
  await service.requestMagicLink(email,randomUUID());
  const owner=await service.consumeMagicLink(extract(sent.at(-1)!));
  expect(await service.getSession(provisional.token)).toBeNull();
  await expect(service.login({email,password},randomUUID())).rejects.toMatchObject({code:'UNAUTHORIZED'});
  expect(owner.session.user.emailVerified).toBe(true);
});

it('counts failed password attempts even when authentication fails and enforces 10 per 15 minutes', async () => {
  const { service, email, advance } = setup();
  await service.register({ email, password, displayName: 'Jordan' }, randomUUID());
  const ip = randomUUID();
  for (let i = 0; i < 10; i++) await expect(service.login({ email, password: 'incorrect password' }, ip)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  await expect(service.login({ email, password }, ip)).rejects.toMatchObject({ code: 'RATE_LIMIT' });
  advance(900_000);
  expect((await service.login({ email, password }, ip)).session.user.email).toBe(email);
});

it('binds tokens to purpose, rejects expired verification and atomically consumes reset under concurrency', async () => {
  const { service, email, sent, advance } = setup();
  await service.register({ email, password, displayName: 'Jordan' }, randomUUID());
  const verify = extract(sent[0]);
  await expect(service.resetPassword({ token: verify, password: 'new strong password' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  advance(86_400_000);
  await expect(service.verifyEmail(verify)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  const oldSession = await service.login({ email, password }, randomUUID());
  await service.forgotPassword(email, randomUUID());
  const token = extract(sent.at(-1)!);
  const results = await Promise.allSettled([
    service.resetPassword({ token, password: 'new strong password' }), service.resetPassword({ token, password: 'other strong password' }),
  ]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(await service.getSession(oldSession.token)).toBeNull();
  await expect(service.login({ email, password }, randomUUID())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
});

it('expires password reset after 30 minutes and limits it to three per email per hour', async () => {
  const { service, email, sent, advance } = setup();
  await service.register({ email, password, displayName: 'Jordan' }, randomUUID());
  for (let i = 0; i < 3; i++) await service.forgotPassword(email, randomUUID());
  await expect(service.forgotPassword(email, randomUUID())).rejects.toMatchObject({ code: 'RATE_LIMIT' });
  const token = extract(sent.at(-1)!);
  advance(1_800_000);
  await expect(service.resetPassword({ token, password: 'new strong password' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
});

it('requires current password, revokes other devices and preserves the current session on password change', async () => {
  const { service, email } = setup();
  await service.register({ email, password, displayName: 'Jordan' }, randomUUID());
  const a = await service.login({ email, password }, randomUUID());
  const b = await service.login({ email, password }, randomUUID());
  await expect(service.changePassword(a.token, { currentPassword: 'wrong password', password: 'new strong password' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await service.changePassword(a.token, { currentPassword: password, password: 'new strong password' });
  expect(await service.getSession(b.token)).toBeNull();
  expect((await service.getSession(a.token))?.user.id).toBe(a.session.user.id);
  await service.logoutAll(a.token);
  expect(await service.getSession(a.token)).toBeNull();
});

it('changes email only after confirmation, keeps the new address verified and rejects occupied addresses', async () => {
  const { service, email, sent } = setup();
  await service.register({ email, password, displayName: 'Jordan' }, randomUUID());
  const a = await service.login({ email, password }, randomUUID());
  const nextEmail = `${randomUUID()}@example.com`;
  await service.changeEmail(a.token, { email: nextEmail, currentPassword: password });
  expect((await service.getSession(a.token))?.user.email).toBe(email);
  const verified=await service.verifyEmail(extract(sent.at(-1)!));
  expect(await service.getSession(a.token)).toBeNull();
  expect((await service.getSession(verified.token))?.user).toMatchObject({ email: nextEmail, emailVerified: true });
  await expect(service.login({ email, password }, randomUUID())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  expect((await service.login({ email: nextEmail, password }, randomUUID())).session.user.email).toBe(nextEmail);
  await service.register({email,password,displayName:'Another account'},randomUUID());
  await service.changeEmail(verified.token,{email,currentPassword:password});
  await expect(service.verifyEmail(extract(sent.at(-1)!))).rejects.toMatchObject({status:409});
  expect((await service.getSession(verified.token))?.user.email).toBe(nextEmail);
});

it('supports profile name updates, confirmed deletion, and removes all account sessions and tokens', async () => {
  const { service, email } = setup();
  await service.register({ email, password, displayName: 'Jordan' }, randomUUID());
  const a = await service.login({ email, password }, randomUUID());
  expect(await service.updateAccount(a.token, { displayName: 'Jordan Doe' })).toMatchObject({ displayName: 'Jordan Doe' });
  await expect(service.deleteAccount(a.token, { confirm: 'DELETE', currentPassword: 'incorrect password' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await service.deleteAccount(a.token, { confirm: 'DELETE', currentPassword: password });
  expect(await service.getSession(a.token)).toBeNull();
  expect((await state.db.query('SELECT id FROM users WHERE email=$1', [email])).rows).toHaveLength(0);
  expect((await state.db.query('SELECT id FROM auth_tokens WHERE user_id=$1', [a.session.user.id])).rows).toHaveLength(0);
});

it('rechecks revocation after waiting for the account lock', async () => {
  const {service,email,sent}=setup();
  await service.requestMagicLink(email,randomUUID());
  const member=await service.consumeMagicLink(extract(sent.at(-1)!));
  let locked!:()=>void, release!:()=>void;
  const ready=new Promise<void>(resolve=>{locked=resolve;});
  const proceed=new Promise<void>(resolve=>{release=resolve;});
  const blocker=state.db.transaction(async tx=>{
    await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[member.session.user.id]);
    locked();await proceed;
    await tx.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1',[member.session.user.id]);
    await tx.query('UPDATE auth_tokens SET consumed_at=now() WHERE user_id=$1',[member.session.user.id]);
  });
  await ready;
  const action=service.changeEmail(member.token,{email:`${randomUUID()}@example.com`}).then(value=>({value}),error=>({error}));
  try {
    let waiting=false;
    for(let i=0;i<100&&!waiting;i++) {
      const locks=await state.db.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%SELECT u.*,s.id AS session_id%'");
      waiting=locks.rows.length>0;
      if(!waiting) await new Promise(resolve=>setTimeout(resolve,10));
    }
    expect(waiting).toBe(true);
  } finally {release();await blocker;}
  expect(await action).toMatchObject({error:{code:'UNAUTHORIZED'}});
  expect((await state.db.query("SELECT id FROM auth_tokens WHERE user_id=$1 AND purpose='change_email' AND consumed_at IS NULL",[member.session.user.id])).rows).toHaveLength(0);
});
