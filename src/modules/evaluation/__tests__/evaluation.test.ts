import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/modules/database';
import { createJobsService } from '@/modules/jobs';
import { createLlmService, MockProvider, type EvaluatedMoves, type LlmCallRecorder } from '@/modules/llm';
import { SubmittedSnapshot } from '@/modules/simulation';
import { createTestDatabase } from '../../../../tests/backend/db-helper';
import { createEvaluationService, type EvaluationDeps } from '../index';
import strong from './golden/strong.json';
import { snapshotFor } from './support';

describe('evaluation publication on PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
  let db: Database;
  beforeAll(async () => {
    fixture = await createTestDatabase();
    db = fixture.db;
  });
  afterAll(async () => { await fixture?.cleanup(); });

  async function stage(onEvaluated?: EvaluationDeps['onEvaluated'], proposals?: (response: EvaluatedMoves) => EvaluatedMoves[]) {
    const { snapshot, response } = snapshotFor(strong);
    await db.query('TRUNCATE users CASCADE');
    await db.query('INSERT INTO users(id,email) VALUES($1,$2)', [snapshot.case.userId, 'eva@example.test']);
    await db.query(`INSERT INTO cases(id,user_id,field,subfield,type,workspace,status,submitted_snapshot)
      VALUES($1,$2,'sales','sdr_outbound','onboarding','chat','submitted',$3)`,
    [snapshot.case.id, snapshot.case.userId, JSON.stringify(snapshot)]);
    const persona = snapshot.case.personas[0];
    await db.query('INSERT INTO personas(id,case_id,public,hidden) VALUES($1,$2,$3,$4)',
      [persona.public.id, snapshot.case.id, JSON.stringify(persona.public), JSON.stringify(persona.hidden)]);
    for (const event of snapshot.events) {
      await db.query('INSERT INTO events(id,case_id,seq,actor,persona_id,type,content,meta,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [event.id, event.caseId, event.seq, event.actor, event.personaId, event.type, event.content, JSON.stringify(event.meta), event.createdAt]);
    }
    let clock = Date.now();
    const now = () => new Date(clock);
    const jobs = createJobsService({ db, now });
    const spy = vi.fn<LlmCallRecorder>(async () => {});
    const llm = createLlmService({ provider: new MockProvider({ 'eval.moves': (proposals?.(response) ?? [response, response]).map((item) => JSON.stringify(item)) }),
      defaultModel: 'fixture-scorer', now, recordCall: spy });
    const simulation: EvaluationDeps['simulation'] = {
      async loadSubmission(caseId) {
        const row = (await db.query('SELECT submitted_snapshot FROM cases WHERE id=$1', [caseId])).rows[0];
        return row?.submitted_snapshot ? SubmittedSnapshot.parse(row.submitted_snapshot) : null;
      },
    };
    const evalService = createEvaluationService({ db, now, jobs, llm, simulation, onEvaluated });
    await jobs.enqueue({ caseId: snapshot.case.id, kind: 'case.evaluate', dedupeKey: `case.evaluate:${snapshot.case.id}`, payload: { snapshotVersion: 1 } });
    async function claim(owner = 'worker') {
      const job = await jobs.claim(owner, { caseId: snapshot.case.id, leaseMs: 1000 });
      if (!job?.leaseToken) throw new Error('Expected evaluation job');
      return { job, lease: { jobId: job.id, owner, token: job.leaseToken } };
    }
    return { snapshot, evalService, jobs, claim, spy, advance: () => { clock += 1001; } };
  }

  it('publishes the owner review and callback atomically and reuses the result after replay', async () => {
    const callback = vi.fn<NonNullable<EvaluationDeps['onEvaluated']>>(async (tx, snapshot, evaluation) => {
      const status = (await tx.query('SELECT status FROM cases WHERE id=$1', [snapshot.case.id])).rows[0].status;
      expect(status).toBe('evaluated');
      expect(evaluation.accuracy).toBe(95);
    });
    const { snapshot, evalService, claim, spy } = await stage(callback);
    const { id, userId } = snapshot.case;
    await expect(evalService.getReview(id, userId)).rejects.toMatchObject({ code: 'VALIDATION', status: 409 });
    const { job, lease } = await claim();
    await evalService.handleEvaluateJob(job, lease);
    await evalService.handleEvaluateJob(job, lease);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    const review = await evalService.getReview(id, userId);
    expect(review.evaluation).toMatchObject({ accuracy: 95, trapCaught: true, scoreAudit: { scorerPromptVersion: '5' } });
    expect(review.evaluation.trustCurve).toHaveLength(4);
    expect(review.moves.every(({ innerThought }) => innerThought === 'The operational details matter.')).toBe(true);
    expect(review.evaluation).toHaveProperty('processObservations');
    await expect(evalService.getReview(id, '16000000-0000-4000-8000-000000004005')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects a stale or wrong job lease before publishing and commits once after reclaim', async () => {
    const { snapshot, evalService, claim, advance, spy } = await stage();
    const { id } = snapshot.case;
    const expired = await claim();
    await expect(evalService.handleEvaluateJob({ ...expired.job, caseId: '16000000-0000-4000-8000-000000004005' }, expired.lease)).rejects.toThrow();
    advance();
    const fresh = await claim('another-worker');
    await expect(evalService.handleEvaluateJob(expired.job, expired.lease)).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
    await evalService.handleEvaluateJob(fresh.job, fresh.lease);
    expect((await db.query('SELECT count(*)::int AS count FROM evaluations WHERE case_id=$1', [id])).rows[0].count).toBe(1);
  });

  it('repairs an assessed response with missing criterion evidence before publication', async () => {
    const { snapshot, evalService, claim, spy } = await stage(undefined, (response) => {
      const malformed = structuredClone(response);
      malformed.moves[0].rubricRef = null;
      malformed.moves[0].evidence = [];
      return [malformed, response];
    });
    const { lease } = await claim();
    const review = await evalService.evaluateCase(snapshot.case.id, lease);
    expect(spy.mock.calls.map(([record]) => record.status)).toEqual(['invalid_schema', 'success']);
    expect(review.evaluation.accuracy).toBe(95);
    expect(review.moves.every((move) => move.assessmentStatus === 'assessed')).toBe(true);
  });

  it('returns only public transcript fields for the evaluated owner, consistently on replay', async () => {
    const { snapshot, evalService, claim } = await stage();
    const last = snapshot.events.at(-1)!;
    const privateEvent = { ...last, id: '16000000-0000-4000-8000-000000009999', seq: last.seq + 1,
      content: 'private-event-content', isPublic: false };
    snapshot.events.push(privateEvent);
    await db.query('UPDATE cases SET submitted_snapshot=$2 WHERE id=$1', [snapshot.case.id, JSON.stringify(snapshot)]);
    await db.query('INSERT INTO events(id,case_id,seq,actor,persona_id,type,content,meta,is_public) VALUES($1,$2,$3,$4,$5,$6,$7,$8,false)',
      [privateEvent.id, privateEvent.caseId, privateEvent.seq, privateEvent.actor, privateEvent.personaId,
        privateEvent.type, privateEvent.content, JSON.stringify({ hidden: 'private-meta-value' })]);
    const otherCaseId = '16000000-0000-4000-8000-000000009998';
    await db.query(`INSERT INTO cases(id,user_id,field,subfield,type,workspace,status)
      VALUES($1,$2,'sales','sdr_outbound','onboarding','chat','evaluated')`, [otherCaseId, snapshot.case.userId]);
    await db.query(`INSERT INTO events(id,case_id,seq,actor,type,content,is_public)
      VALUES($1,$2,1,'system','twist','other-case-public-content',true)`,
      ['16000000-0000-4000-8000-000000009997', otherCaseId]);
    const { lease } = await claim();
    const immediate = await evalService.evaluateCase(snapshot.case.id, lease);
    const loaded = await evalService.getReview(snapshot.case.id, snapshot.case.userId);
    expect(immediate.transcript).toHaveLength(snapshot.events.length - 1);
    expect(loaded.transcript).toEqual(immediate.transcript);
    for (const transcript of [immediate.transcript, loaded.transcript]) {
      expect(transcript.map(({ seq }) => seq)).toEqual([...transcript.map(({ seq }) => seq)].sort((a, b) => a - b));
      for (const event of transcript) expect(Object.keys(event).sort()).toEqual(['actor', 'content', 'createdAt', 'id', 'seq', 'type']);
      expect(JSON.stringify(transcript)).not.toMatch(/private-event-content|private-meta-value|other-case-public-content|innerThought|realMotive|rubric/);
    }
  });

  it('stops after three invalid semantic proposals without publishing an empty score', async () => {
    const { snapshot, evalService, claim, spy } = await stage(undefined, (response) => {
      const malformed = structuredClone(response);
      malformed.moves.pop();
      return [malformed, malformed, malformed];
    });
    const { lease } = await claim();
    await expect(evalService.evaluateCase(snapshot.case.id, lease)).rejects.toThrow('failed validation after three attempts');
    expect(spy.mock.calls.map(([record]) => record.status)).toEqual(['invalid_schema', 'invalid_schema', 'invalid_schema']);
    expect((await db.query('SELECT case_id FROM evaluations WHERE case_id=$1', [snapshot.case.id])).rowCount).toBe(0);
    expect((await db.query('SELECT status FROM cases WHERE id=$1', [snapshot.case.id])).rows[0].status).toBe('submitted');
  });

  it('rolls back the review, status and completion when the downstream transaction fails', async () => {
    const { snapshot, evalService, claim } = await stage(async () => { throw new Error('Publication callback failed'); });
    const { id } = snapshot.case;
    const { job, lease } = await claim();
    await expect(evalService.handleEvaluateJob(job, lease)).rejects.toThrow('Publication callback failed');
    expect((await db.query('SELECT status FROM cases WHERE id=$1', [id])).rows[0].status).toBe('submitted');
    expect((await db.query('SELECT status FROM jobs WHERE id=$1', [job.id])).rows[0].status).toBe('running');
    expect((await db.query('SELECT case_id FROM evaluations WHERE case_id=$1', [id])).rowCount).toBe(0);
    expect((await db.query('SELECT case_id FROM move_reviews WHERE case_id=$1', [id])).rowCount).toBe(0);
  });

  it('reconciles a terminal evaluation failure after the final lease expires', async () => {
    const { snapshot, evalService, jobs, claim, advance } = await stage();
    for (let attempt = 0; attempt < 3; attempt += 1) { await claim(); advance(); }
    await expect(jobs.claim('worker')).resolves.toBeNull();
    expect(await evalService.reconcileFailedEvaluations()).toBe(1);
    expect(await evalService.reconcileFailedEvaluations()).toBe(0);
    const { id, userId } = snapshot.case;
    await expect(evalService.getReview(id, userId)).rejects.toMatchObject({ code: 'LLM_FAILED' });
  });
});
