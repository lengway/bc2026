import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { skillsForFocus } from '@/contracts/focus';
import { RubricTwist } from '@/contracts/rubric';
import { createCatalogService, type DemoCase } from '@/modules/catalog';
import { createJobsService, type Job } from '@/modules/jobs';
import { createLlmService, MockProvider, type LlmCallRecord } from '@/modules/llm';
import { createTestDatabase } from '../../../tests/backend/db-helper';
import { reviewedCase } from '../../../tests/backend/review-fixture';
import { createCaseEngineService } from './index';

describe('case engine on PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
  const catalog = createCatalogService();

  beforeAll(async () => { fixture = await createTestDatabase(); });
  afterAll(async () => { await fixture?.cleanup(); });

  async function user(level = 'beginner') {
    const userId = randomUUID();
    await fixture.db.query('INSERT INTO users(id,email) VALUES ($1,$2)', [userId, `${userId}@example.test`]);
    await fixture.db.query(`INSERT INTO profiles(user_id,intake_text,field,subfield,level,years)
      VALUES ($1,'I work with regional fleets','sales','sdr_outbound',$2,2)`, [userId, level]);
    return userId;
  }

  function setup(responses: Record<string, string[]> = {}, options: { allow?: boolean; demoMode?: boolean } = {}) {
    let time = Date.now();
    const now = () => new Date(time);
    const jobs = createJobsService({ db: fixture.db, now });
    const calls: LlmCallRecord[] = [];
    const llm = createLlmService({
      provider: new MockProvider(responses), defaultModel: 'test-model', now,
      async recordCall(call) { calls.push(call); },
    });
    const deps = { db: fixture.db, jobs, catalog, llm, now, demoMode: options.demoMode,
      canStart: options.allow === undefined ? undefined : async () => options.allow === true };
    return { engine: createCaseEngineService(deps), calls, jobs, now, deps,
      advance: (ms: number) => { time += ms; } };
  }

  async function claim(jobs: ReturnType<typeof createJobsService>, caseId: string, owner = 'worker') {
    const job = await jobs.claim(owner, { caseId, leaseMs: 1_000 });
    if (!job?.leaseToken) throw new Error('Expected leased generation job');
    return { job, lease: { jobId: job.id, owner, token: job.leaseToken } };
  }

  function outputs(demo: DemoCase, name: string, company: string, lateDocument = false) {
    const docs = demo.case.docs.map((doc) => lateDocument && doc.kind === 'note' ? { ...doc, arrivesAtTurn: 2 } : doc);
    return {
      generated: JSON.stringify({ brief: demo.case.brief, docs,
        personas: demo.personas.map((persona) => ({ ...persona, public: { ...persona.public, name, company } })) }),
      rubric: JSON.stringify({
        ...demo.rubric,
        criteria: demo.rubric.criteria.map((criterion) => ({
          ...criterion, title: 'Criterion with a secret answer', description: 'Quote $42 if the customer mentions the confidential cap.',
        })),
        traps: demo.rubric.traps.map((trap) => ({ ...trap, howToCatch: `${trap.howToCatch} Archive reference: mycrm-context.` })),
      }),
    };
  }

  it('rolls back the case when job enqueue fails after writing the job', async () => {
    const userId = await user();
    const { deps, jobs } = setup();
    const engine = createCaseEngineService({ ...deps, jobs: {
      ...jobs,
      async enqueueWithExecutor(tx, input) {
        await jobs.enqueueWithExecutor(tx, input);
        throw new Error('queue write failed');
      },
    } });
    await expect(engine.generateCase(userId, 'daily')).rejects.toThrow('queue write failed');
    expect((await fixture.db.query('SELECT id FROM cases WHERE user_id=$1', [userId])).rows).toEqual([]);
  });

  it('publishes a private generation snapshot and exposes only available documents to its owner', async () => {
    const userId = await user();
    const outsider = await user();
    const demo = await catalog.getDemoCase('sales', 'sdr_outbound');
    const first = outputs(demo, 'Marta Rowe', 'Adler Freight', true);
    const second = outputs(demo, 'Lydia Park', 'Northwind Carriers');
    const { engine, calls, jobs } = setup({
      'case.generate': [first.generated, second.generated],
      'case.rubric': [first.rubric, second.rubric],
    }, { allow: true });
    const created = await engine.generateCase(userId, 'onboarding');
    expect(created.status).toBe('generating');
    await expect(engine.getCaseForUser(created.caseId, userId)).resolves.toEqual({ id: created.caseId, status: 'generating' });
    await expect(engine.getCaseForUser(created.caseId, outsider)).rejects.toMatchObject({ status: 404 });
    await fixture.db.query("UPDATE profiles SET intake_text='changed', level='advanced' WHERE user_id=$1", [userId]);
    const { job, lease } = await claim(jobs, created.caseId);
    await engine.handleGenerateJob(job, lease);
    const record = await engine.getCaseRecord(created.caseId);
    if (!record?.rubric) throw new Error('Expected a ready case with its internal rubric');
    expect(record).toMatchObject({ status: 'ready', level: 'beginner', model: 'test-model', promptVersion: '1', isDemo: false });
    expect(record.personas[0]).toMatchObject({ state: { trust: demo.personas[0].hidden.initialTrust, patience: demo.personas[0].hidden.patience } });
    expect(record.personas[0].public.id).not.toBe(demo.personas[0].public.id);
    expect(record.rubric.aiUseChecks[0].sourceRefs).toEqual([record.docs.find((doc) => doc.kind === 'crm_record')?.id]);
    expect(record.rubric.traps[0].howToCatch).toContain(record.rubric.aiUseChecks[0].sourceRefs[0]);
    expect(record.rubric.traps[0].howToCatch).toContain('mycrm-context');
    expect(calls[0].input).toMatchObject({ profile: { level: 'beginner', intakeText: 'I work with regional fleets' } });
    expect((await fixture.db.query('SELECT status FROM jobs WHERE id=$1', [job.id])).rows[0].status).toBe('completed');
    const ready = await engine.getCaseForUser(created.caseId, userId);
    expect(ready).toMatchObject({ status: 'ready', startedAt: null, scoringGuide: { version: record.rubric.version } });
    expect(JSON.stringify(ready)).not.toMatch(/realMotive|howToCatch|idealMove|term-trap|confidential cap/);
    const late = record.docs.find((doc) => doc.arrivesAtTurn === 2);
    if (!late) throw new Error('Expected a document that opens on turn two');
    expect(JSON.stringify(ready)).not.toContain(late.id);
    const startedAt = '2026-07-01T09:00:00.000Z';
    await fixture.db.query("UPDATE cases SET started_at=$2,status='submitted' WHERE id=$1", [created.caseId, startedAt]);
    await fixture.db.query('UPDATE persona_state SET turn=2 WHERE case_id=$1', [created.caseId]);
    const submitted = await engine.getCaseForUser(created.caseId, userId);
    expect(submitted).toMatchObject({ status: 'evaluating', startedAt, docs: expect.arrayContaining([expect.objectContaining({ id: late.id })]) });
    const next = await engine.generateCase(userId, 'daily');
    const nextLease = await claim(jobs, next.caseId);
    await engine.handleGenerateJob(nextLease.job, nextLease.lease);
    expect(calls[2].input).toMatchObject({ avoid: {
      names: ['Marta Rowe'], companies: ['Adler Freight'], archetypes: [record.archetypeId], titles: [record.brief?.title],
    } });
    const nextRecord = await engine.getCaseRecord(next.caseId);
    expect(nextRecord?.archetypeId).not.toBe(record.archetypeId);
    expect(nextRecord?.personas[0].public.id).not.toBe(record.personas[0].public.id);
  });

  it('publishes seeded scenario data on onboarding failure and exposes failed daily generation without a brief', async () => {
    const userId = await user();
    const { engine, jobs } = setup();
    const onboarding = await engine.generateCase(userId, 'onboarding');
    const onboardingWork = await claim(jobs, onboarding.caseId);
    await engine.handleGenerateJob(onboardingWork.job, onboardingWork.lease);
    await expect(engine.getCaseRecord(onboarding.caseId)).resolves.toMatchObject({ status: 'ready', isDemo: true, timeLimitSec: 480 });
    const daily = await engine.generateCase(userId, 'daily');
    const dailyWork = await claim(jobs, daily.caseId);
    await engine.handleGenerateJob(dailyWork.job, dailyWork.lease);
    await expect(engine.getCaseForUser(daily.caseId, userId)).resolves.toEqual({ id: daily.caseId, status: 'failed' });
    expect((await fixture.db.query('SELECT count(*)::int AS count FROM rubrics WHERE case_id=$1', [daily.caseId])).rows[0].count).toBe(0);
  });

  it('uses unfinished daily skill series and honors an explicit daily target', async () => {
    const userId = await user();
    const demo = await catalog.getDemoCase('sales', 'sdr_outbound');
    const automatic = outputs(demo, 'Julia Crane', 'Everton Freight');
    const targeted = outputs(demo, 'Robin Cook', 'Brightway Freight');
    const { engine, jobs, now } = setup({
      'case.generate': [automatic.generated, targeted.generated],
      'case.rubric': [automatic.rubric, targeted.rubric],
    }, { allow: true });
    const sample = await reviewedCase(fixture.db, { userId, submittedAt: now().toISOString() });
    await fixture.db.query("UPDATE cases SET archetype_id='outage' WHERE id=$1", [sample.caseId]);
    await fixture.db.query(`INSERT INTO evaluations(case_id,accuracy,label_counts,trap_caught,outcome,summary,skills,
      assistance,ai_use_skill,trap_result,score_audit,process_observations)
      VALUES($1,75,'{}',false,'won','Test score','[]','{}','{}','not_presented','{}','{}')`, [sample.caseId]);

    const pack = await catalog.getPack('sales');
    await expect(engine.generateCase(userId, 'weekly', { skill: 'closing' })).rejects.toMatchObject({ code: 'VALIDATION' });

    const autoCase = await engine.generateCase(userId, 'daily');
    const autoWork = await claim(jobs, autoCase.caseId);
    await engine.handleGenerateJob(autoWork.job, autoWork.lease);
    const autoId = (await engine.getCaseRecord(autoCase.caseId))?.archetypeId;
    expect(autoId).not.toBe('outage');
    expect(skillsForFocus(pack.archetypes.find(({ id }) => id === autoId)!.focus)).toContain('objection_handling');

    const targetCase = await engine.generateCase(userId, 'daily', { skill: 'closing' });
    const targetWork = await claim(jobs, targetCase.caseId);
    expect(targetWork.job.payload.skill).toBe('closing');
    await engine.handleGenerateJob(targetWork.job, targetWork.lease);
    const targetId = (await engine.getCaseRecord(targetCase.caseId))?.archetypeId;
    expect(skillsForFocus(pack.archetypes.find(({ id }) => id === targetId)!.focus)).toContain('closing');
  });

  it('preserves rubric prose when a scenario ID is also a word in a commercial term', async () => {
    const userId = await user();
    const demo = await catalog.getDemoCase('sales', 'sdr_outbound');
    const generated = {
      brief: demo.case.brief,
      docs: demo.case.docs.map((doc) => doc.kind === 'crm_record' ? { ...doc, id: 'pilot' } : doc),
      personas: demo.personas,
    };
    const check = {
      ...demo.rubric.aiUseChecks[0],
      description: 'Confirm that the pilot costs $1,800 per month.',
      sourceRefs: ['pilot', demo.personas[0].public.id],
    };
    const { engine, jobs } = setup({
      'case.generate': [JSON.stringify(generated)],
      'case.rubric': [JSON.stringify({ ...demo.rubric, aiUseChecks: [check] })],
    });
    const { caseId } = await engine.generateCase(userId, 'onboarding');
    const work = await claim(jobs, caseId);
    await engine.handleGenerateJob(work.job, work.lease);
    const record = await engine.getCaseRecord(caseId);
    if (!record) throw new Error('Expected generated case');
    expect(record.rubric?.aiUseChecks[0]).toMatchObject({
      description: 'Confirm that the pilot costs $1,800 per month.',
      sourceRefs: ['pilot', record.personas[0].public.id],
    });
    expect(record.docs.find((doc) => doc.kind === 'crm_record')?.id).toBe('pilot');
  });

  it('retries a twist with a missing document and stores only known document links', async () => {
    const userId = await user();
    const demo = await catalog.getDemoCase('sales', 'sdr_outbound');
    const output = outputs(demo, 'Marta Rowe', 'Adler Freight', true);
    const twist = {
      id: 'ops-update',
      trigger: { afterUserTurn: 1 },
      event: { kind: 'slack', from: 'Operations', content: 'Sharing the updated count.' },
    };
    expect(RubricTwist.parse(twist).documentIds).toEqual([]);
    const { engine, jobs, calls } = setup({
      'case.generate': [output.generated],
      'case.rubric': [
        JSON.stringify({ ...demo.rubric, twists: [{ ...twist, documentIds: ['missing-doc'] }] }),
        JSON.stringify({ ...demo.rubric, twists: [{ ...twist, documentIds: ['ops-note'] }] }),
      ],
    });
    const { caseId } = await engine.generateCase(userId, 'onboarding');
    const work = await claim(jobs, caseId);
    await engine.handleGenerateJob(work.job, work.lease);
    expect(calls.map(({ status }) => status)).toEqual(['success', 'invalid_schema', 'success']);
    expect((await engine.getCaseRecord(caseId))?.rubric?.twists[0].documentIds).toEqual(['ops-note']);
  });

  it('allows demo mode fallback for daily with its own timer and preserves free entitlement under concurrency', async () => {
    const userId = await user();
    const { engine, jobs } = setup({}, { demoMode: true });
    await expect(engine.generateCase(userId, 'weekly')).rejects.toMatchObject({ code: 'PAYWALL' });
    const results = await Promise.allSettled([engine.generateCase(userId, 'daily'), engine.generateCase(userId, 'daily')]);
    const fulfilled = results.find((result) => result.status === 'fulfilled');
    const rejected = results.find((result) => result.status === 'rejected');
    if (!fulfilled) throw new Error('Expected one daily entitlement');
    expect(rejected).toMatchObject({ reason: { code: 'PAYWALL' } });
    const { job, lease } = await claim(jobs, fulfilled.value.caseId);
    await engine.handleGenerateJob(job, lease);
    await expect(engine.getCaseRecord(job.caseId)).resolves.toMatchObject({ status: 'ready', isDemo: true, timeLimitSec: 600 });
  });

  it('keeps free daily quota after an evaluation failure but releases an unstarted failed generation', async () => {
    const evaluatedUser = await user();
    const generationUser = await user();
    const startedUser = await user();
    const { engine } = setup();
    await fixture.db.query(`INSERT INTO cases(user_id,field,subfield,type,workspace,status,started_at,submitted_at)
      VALUES($1,'sales','sdr_outbound','daily','chat','failed',now(),now())`, [evaluatedUser]);
    await fixture.db.query(`INSERT INTO cases(user_id,field,subfield,type,workspace,status)
      VALUES($1,'sales','sdr_outbound','daily','chat','failed')`, [generationUser]);
    const startedCaseId = randomUUID();
    await fixture.db.query(`INSERT INTO cases(id,user_id,field,subfield,type,workspace,status,started_at)
      VALUES($1,$2,'sales','sdr_outbound','daily','chat','generating',now())`, [startedCaseId,startedUser]);
    await fixture.db.query("INSERT INTO jobs(kind,case_id,dedupe_key,payload,status) VALUES('case.generate',$1,$2,'{}','failed')", [startedCaseId,randomUUID()]);
    await expect(engine.generateCase(evaluatedUser,'daily')).rejects.toMatchObject({ code: 'PAYWALL' });
    await expect(engine.generateCase(startedUser,'daily')).rejects.toMatchObject({ code: 'PAYWALL' });
    await expect(engine.generateCase(generationUser,'daily')).resolves.toMatchObject({ status: 'generating' });
    await fixture.db.query("UPDATE cases SET status='failed' WHERE id=$1", [startedCaseId]);
  });

  it('fences writes by job and lease, and permits replay after a valid publication', async () => {
    const userId = await user();
    const demo = await catalog.getDemoCase('sales', 'sdr_outbound');
    const output = outputs(demo, 'Lydia Park', 'Northwind Carriers');
    const { engine, jobs, advance } = setup({
      'case.generate': [output.generated], 'case.rubric': [output.rubric],
    });
    const request = await engine.generateCase(userId, 'onboarding');
    const other = await engine.generateCase(userId, 'onboarding');
    const stale = await claim(jobs, request.caseId);
    const forged: Job = { ...stale.job, caseId: other.caseId };
    await expect(engine.handleGenerateJob(forged, stale.lease)).rejects.toThrow();
    advance(1_001);
    const reclaimed = await claim(jobs, request.caseId, 'another-worker');
    await expect(engine.handleGenerateJob(stale.job, stale.lease)).rejects.toThrow();
    await expect(engine.getCaseForUser(request.caseId, userId)).resolves.toEqual({ id: request.caseId, status: 'generating' });
    await engine.handleGenerateJob(reclaimed.job, reclaimed.lease);
    await engine.handleGenerateJob(reclaimed.job, reclaimed.lease);
    expect((await fixture.db.query('SELECT id FROM personas WHERE case_id=$1', [request.caseId])).rowCount).toBe(1);
    await expect(engine.getCaseForUser(other.caseId, userId)).resolves.toEqual({ id: other.caseId, status: 'generating' });
  });

  it('reports terminal failure when all job lease attempts expire', async () => {
    const { engine, jobs, advance } = setup();
    const userId = await user();
    const created = await engine.generateCase(userId, 'onboarding');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await claim(jobs, created.caseId);
      advance(1_001);
    }
    await expect(jobs.claim('another-worker', { caseId: created.caseId })).resolves.toBeNull();
    await expect(engine.getCaseForUser(created.caseId, userId)).resolves.toEqual({ id: created.caseId, status: 'failed' });
    expect(await engine.reconcileFailedGenerations()).toBe(1);
    expect((await fixture.db.query('SELECT status FROM cases WHERE id=$1', [created.caseId])).rows).toEqual([{ status: 'failed' }]);
    expect(await engine.reconcileFailedGenerations()).toBe(0);
  });

  it('caps successful generation requests per user and restores capacity after an hour', async () => {
    const userId = await user();
    const { engine, advance } = setup();
    for (let request = 0; request < 10; request += 1) await engine.generateCase(userId, 'onboarding');
    await expect(engine.generateCase(userId, 'onboarding')).rejects.toMatchObject({ code: 'RATE_LIMIT', status: 429 });
    expect((await fixture.db.query('SELECT id FROM cases WHERE user_id=$1', [userId])).rowCount).toBe(10);
    advance(3_600_000);
    await expect(engine.generateCase(userId, 'onboarding')).resolves.toMatchObject({ status: 'generating' });
  });

  it('seeds reusable variants per role and level, prefers focus, and queues when all variants have been used', async () => {
    const pack = await catalog.getPack('sales');
    const demo = await catalog.getDemoCase('sales', 'sdr_outbound');
    const generated = pack.subfields.flatMap((subfield, index) => Array.from({ length: 9 }, (_, i) =>
      outputs(demo, `Robin Ward ${index}-${i}`, `Harbor Freight ${subfield}-${i}`)));
    const { engine, calls } = setup({
      'case.generate': generated.map(({ generated }) => generated),
      'case.rubric': generated.map(({ rubric }) => rubric),
    });
    expect(await engine.seedOnboardingPool()).toEqual({ inserted: 27, existing: 0 });
    expect(await engine.seedOnboardingPool()).toEqual({ inserted: 0, existing: 27 });
    expect(calls).toHaveLength(54);
    const firstUser = await user();
    const secondUser = await user();
    await fixture.db.query("UPDATE profiles SET intake_text='Wants to practice: Competitor deals.' WHERE user_id=ANY($1::uuid[])",
      [[firstUser, secondUser]]);
    const first = await engine.generateCase(firstUser, 'onboarding');
    const second = await engine.generateCase(secondUser, 'onboarding');
    const third = await engine.generateCase(firstUser, 'onboarding');
    const fourth = await engine.generateCase(firstUser, 'onboarding');
    const fifth = await engine.generateCase(firstUser, 'onboarding');
    const ids = [first.caseId, second.caseId, third.caseId, fourth.caseId, fifth.caseId];
    const rows = z.array(z.object({ id: z.uuid(), onboarding_pool_id: z.uuid().nullable(), status: z.string() })).parse(
      (await fixture.db.query('SELECT id,onboarding_pool_id,status FROM cases WHERE id=ANY($1::uuid[])', [ids])).rows,
    );
    const row = (id: string) => rows.find((result) => result.id === id);
    const poolId = row(first.caseId)?.onboarding_pool_id;
    expect(poolId).toBeTruthy();
    expect(row(second.caseId)).toMatchObject({ onboarding_pool_id: poolId, status: 'ready' });
    expect(row(third.caseId)?.status).toBe('ready');
    expect(row(fourth.caseId)?.status).toBe('ready');
    expect(new Set([poolId, row(third.caseId)?.onboarding_pool_id, row(fourth.caseId)?.onboarding_pool_id]).size).toBe(3);
    expect(row(fifth.caseId)).toMatchObject({ onboarding_pool_id: null, status: 'generating' });
    const queued = await fixture.db.query('SELECT case_id FROM jobs WHERE case_id=ANY($1::uuid[])', [ids]);
    expect(queued.rows).toEqual([{ case_id: fifth.caseId }]);
    const firstRecord = await engine.getCaseRecord(first.caseId);
    expect(firstRecord).toMatchObject({ archetypeId: 'vendor', status: 'ready' });
    expect(firstRecord?.personas[0].public.id).not.toBe((await engine.getCaseRecord(second.caseId))?.personas[0].public.id);
  });
});
