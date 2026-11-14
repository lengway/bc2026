import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../../tests/backend/db-helper';
import { createJobsService } from './index';

describe('PostgreSQL jobs with fenced leases', () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
  let current = new Date('2026-11-14T12:00:00Z');
  beforeAll(async () => { fixture = await createTestDatabase(); });
  afterAll(async () => { await fixture?.cleanup(); });
  async function setup() {
    const userId = randomUUID(), caseId = randomUUID();
    await fixture.db.query('INSERT INTO users(id,email) VALUES ($1,$2)', [userId, `${userId}@example.test`]);
    await fixture.db.query(`INSERT INTO cases(id,user_id,field,subfield,type,workspace)
      VALUES ($1,$2,'sales','sdr_outbound','onboarding','chat')`, [caseId,userId]);
    // A case filter keeps independently populated fixtures isolated without truncating shared tables.
    return { caseId, service: createJobsService({ db: fixture.db, now: () => current }) };
  }
  it('deduplicates identical enqueues and rejects a different payload with the same key', async () => {
    const { caseId, service } = await setup();
    const input = { kind: 'case.generate' as const, caseId, dedupeKey: randomUUID(), payload: { seed: 'abc' } };
    const [a,b] = await Promise.all([service.enqueue(input),service.enqueue(input)]);
    expect(a.id).toBe(b.id);
    await expect(service.enqueue({ ...input,payload: { seed: 'changed' } })).rejects.toMatchObject({ code: 'VALIDATION' });
    const job = await service.claim('dedupe', { caseId });
    expect(job?.id).toBe(a.id);
    expect(await service.complete(a.id,'dedupe',job!.leaseToken!)).toBe(true);
  });
  it('rolls back an enqueue with the submit transaction', async () => {
    const { caseId, service } = await setup();
    await expect(fixture.db.transaction(async (tx) => {
      await service.enqueueWithExecutor(tx,{ kind: 'case.evaluate',caseId,dedupeKey: randomUUID() });
      throw new Error('abort');
    })).rejects.toThrow('abort');
    expect(await service.claim('rollback',{ caseId })).toBeNull();
  });
  it('gives concurrent workers distinct jobs and skips an actively locked row', async () => {
    const { caseId, service } = await setup();
    const first = await service.enqueue({ kind: 'case.generate',caseId,dedupeKey: randomUUID() });
    const second = await service.enqueue({ kind: 'case.generate',caseId,dedupeKey: randomUUID() });
    await fixture.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM jobs WHERE id=$1 FOR UPDATE',[first.id]);
      const taken = await service.claim('unblocked',{ caseId });
      expect(taken?.id).toBe(second.id);
      await service.complete(taken!.id,'unblocked',taken!.leaseToken!);
    });
    const claims = await Promise.all([service.claim('a',{ caseId }),service.claim('b',{ caseId })]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claims.find(Boolean)?.id).toBe(first.id);
  });
  it('reclaims expired leases and rejects completion by the old token even with the same owner', async () => {
    const { caseId, service } = await setup();
    await service.enqueue({ kind: 'case.evaluate',caseId,dedupeKey: randomUUID() });
    const old = await service.claim('worker',{ caseId,leaseMs: 1000 });
    current = new Date(current.getTime()+1001);
    const next = await service.claim('worker',{ caseId,leaseMs: 1000 });
    expect(next?.id).toBe(old?.id);
    expect(next?.attempts).toBe(2);
    expect(next?.leaseToken).not.toBe(old?.leaseToken);
    expect(await service.complete(old!.id,'worker',old!.leaseToken!)).toBe(false);
    expect(await service.complete(next!.id,'worker',next!.leaseToken!)).toBe(true);
  });
  it('renews only a current lease and prevents expired owners from failing a replacement', async () => {
    const { caseId, service } = await setup();
    await service.enqueue({ kind: 'case.evaluate',caseId,dedupeKey: randomUUID() });
    const job = await service.claim('worker',{ caseId,leaseMs: 1000 });
    expect(await service.renewLease(job!.id,'other',job!.leaseToken!,2000)).toBe(false);
    expect(await service.renewLease(job!.id,'worker',job!.leaseToken!,2000)).toBe(true);
    current = new Date(current.getTime()+1500);
    expect(await service.claim('other',{ caseId })).toBeNull();
    current = new Date(current.getTime()+501);
    expect(await service.fail(job!.id,'worker',job!.leaseToken!,'TRANSIENT')).toBe(false);
  });
  it('respects retry delays and terminal attempt limits including worker crashes', async () => {
    const { caseId, service } = await setup();
    await service.enqueue({ kind: 'case.evaluate',caseId,dedupeKey: randomUUID(),maxAttempts: 2 });
    const first = await service.claim('worker',{ caseId });
    expect(await service.fail(first!.id,'worker',first!.leaseToken!,'TRANSIENT',5000)).toBe(true);
    expect(await service.claim('worker',{ caseId })).toBeNull();
    current = new Date(current.getTime()+5001);
    const last = await service.claim('worker',{ caseId,leaseMs: 1000 });
    expect(last?.attempts).toBe(2);
    current = new Date(current.getTime()+1001);
    expect(await service.claim('worker',{ caseId })).toBeNull();
    expect((await fixture.db.query('SELECT status FROM jobs WHERE id=$1',[first!.id])).rows[0].status).toBe('failed');
  });
  it('fences result publication and completion in one caller transaction', async () => {
    const { caseId, service } = await setup();
    await service.enqueue({ kind: 'case.evaluate',caseId,dedupeKey: randomUUID() });
    const job = await service.claim('publisher',{ caseId });
    await expect(fixture.db.transaction(async (tx) => {
      expect(await service.completeWithExecutor(tx,job!.id,'publisher',job!.leaseToken!)).toBe(true);
      await tx.query("UPDATE cases SET status='evaluated' WHERE id=$1",[caseId]);
      throw new Error('result publication aborted');
    })).rejects.toThrow('result publication aborted');
    expect((await fixture.db.query('SELECT status FROM jobs WHERE id=$1',[job!.id])).rows[0].status).toBe('running');
    expect((await fixture.db.query('SELECT status FROM cases WHERE id=$1',[caseId])).rows[0].status).toBe('generating');
    expect(await service.complete(job!.id,'publisher',job!.leaseToken!)).toBe(true);
  });
});
