import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../../../tests/backend/db-helper';
import { createIdentityService, hashToken } from '../index';

let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { testDb = await createTestDatabase(); });
afterAll(async () => { await testDb?.cleanup(); });

function setup() {
  let time = new Date('2026-11-14T12:00:00Z');
  const sent: {email:string;url:string}[] = [];
  const service = createIdentityService({ db: testDb.db, appUrl: 'https://skills.example', now: () => time,
    mailer: { async sendMagicLink(email, url) { sent.push({email, url}); } } });
  return { service, sent, advance: (ms:number) => { time = new Date(time.getTime() + ms); } };
}
const email = () => `${randomUUID()}@example.com`;
const tokenFrom = (url: string) => new URL(url).searchParams.get('token')!;

describe('PostgreSQL identity', () => {
  it('isolates guest sessions, reuses the current session and disables access with the flag', async () => {
    const base = {db:testDb.db,appUrl:'https://skills.example',mailer:{async sendMagicLink(){throw new Error('Guest must not send email');}}};
    const enabled = createIdentityService({...base,guestAccessEnabled:true});
    const a = await enabled.createGuestSession(randomUUID());
    const b = await enabled.createGuestSession(randomUUID());
    expect(a.session?.user.isGuest).toBe(true);
    expect(a.session?.user.displayName).toBe('Demo Guest');
    expect(a.session?.user.id).not.toBe(b.session?.user.id);
    expect(await enabled.createGuestSession(randomUUID(), a.token)).toEqual(a);
    const disabled = createIdentityService(base);
    expect(await disabled.getSession(a.token)).toBeNull();
    await expect(disabled.createGuestSession(randomUUID())).rejects.toMatchObject({code:'FORBIDDEN'});
    await expect(enabled.requestMagicLink(a.session!.user.email,randomUUID())).rejects.toMatchObject({code:'VALIDATION'});
  });
  it('expires guest access after 24 hours and limits anonymous session creation', async () => {
    let at = new Date();
    const service = createIdentityService({db:testDb.db,appUrl:'https://skills.example',guestAccessEnabled:true,now:()=>at,mailer:{async sendMagicLink(){}}});
    const requestKey = randomUUID();
    const first = await service.createGuestSession(requestKey);
    for (let n=1; n<10; n++) await service.createGuestSession(requestKey);
    await expect(service.createGuestSession(requestKey)).rejects.toMatchObject({code:'RATE_LIMIT'});
    at = new Date(at.getTime()+86_400_000);
    expect(await service.getSession(first.token)).toBeNull();
  });
  it('consumes a link once under concurrency and revokes its session', async () => {
    const {service, sent} = setup();
    const address = email();
    expect(await service.requestMagicLink(address, randomUUID())).toEqual({accepted:true});
    const token = tokenFrom(sent[0].url);
    const attempts = await Promise.allSettled([service.consumeMagicLink(token), service.consumeMagicLink(token)]);
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const winner = attempts.find((result) => result.status === 'fulfilled');
    if (!winner || winner.status !== 'fulfilled') throw new Error('Missing session');
    const session = await service.getSession(winner.value.token);
    expect(session?.user.email).toBe(address);
    const stored = await testDb.db.query('SELECT token_hash FROM sessions WHERE user_id=$1', [session?.user.id]);
    expect(stored.rows[0].token_hash).toBe(hashToken(winner.value.token));
    await service.revokeSession(winner.value.token);
    expect(await service.getSession(winner.value.token)).toBeNull();
  });
  it('rejects expired links and expires sessions by server time', async () => {
    const {service, sent, advance} = setup();
    await service.requestMagicLink(email(), randomUUID());
    advance(900_001);
    await expect(service.consumeMagicLink(tokenFrom(sent[0].url))).rejects.toMatchObject({code:'UNAUTHORIZED'});
    await service.requestMagicLink(email(), randomUUID());
    const session = await service.consumeMagicLink(tokenFrom(sent[1].url));
    advance(30 * 86_400_000);
    expect(await service.getSession(session.token)).toBeNull();
  });
  it('rate limits email requests and permits a new window', async () => {
    const {service, sent, advance} = setup();
    const address = email();
    for (let n = 0; n < 5; n++) await service.requestMagicLink(address, randomUUID());
    await expect(service.requestMagicLink(address, randomUUID())).rejects.toMatchObject({code:'RATE_LIMIT'});
    expect(sent).toHaveLength(5);
    advance(900_000);
    await expect(service.requestMagicLink(address, randomUUID())).resolves.toEqual({accepted:true});
  });
  it('invalidates undelivered tokens without disclosing SMTP internals', async () => {
    const address = email();
    const service = createIdentityService({db:testDb.db,appUrl:'https://skills.example',mailer:{async sendMagicLink(){throw new Error('private SMTP credential');}}});
    await expect(service.requestMagicLink(address,randomUUID())).rejects.toMatchObject({message:'Unable to send a sign-in email. Please try again.'});
    const tokens = await testDb.db.query('SELECT a.id FROM auth_tokens a JOIN users u ON u.id=a.user_id WHERE u.email=$1',[address]);
    expect(tokens.rows).toHaveLength(0);
  });
});
