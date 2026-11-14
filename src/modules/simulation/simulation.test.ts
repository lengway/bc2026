import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { EditorEvent, MoveRequest } from '@/contracts';
import { createCatalogService } from '@/modules/catalog';
import { createCaseEngineService } from '@/modules/case-engine';
import { createEventsService } from '@/modules/events';
import { createJobsService } from '@/modules/jobs';
import { createLlmService, DirectorTwist, type LlmRequest } from '@/modules/llm';
import { createTestDatabase } from '../../../tests/backend/db-helper';
import { createSimulationService, SubmittedSnapshot } from './index';

describe('simulation on PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
  const catalog = createCatalogService();
  beforeAll(async () => { fixture = await createTestDatabase(); });
  afterAll(async () => { await fixture?.cleanup(); });
  const personaReply = { reply: 'Which teams would use this first?', typingMs: 900, trustDelta: 8, patienceDelta: 0,
    revealed: ['operating constraints'], outcome: null, innerThought: 'PRIVATE_THOUGHT_MARKER' };

  async function setup(options: { provider?: (request: LlmRequest) => Promise<unknown>; twoPersonas?: boolean; guest?: boolean; twists?: boolean; twistContent?: string; leaseMs?: number } = {}) {
    const userId = randomUUID();
    await fixture.db.query('INSERT INTO users(id,email,is_guest) VALUES($1,$2,$3)',[userId,`${userId}@example.test`,options.guest ?? false]);
    await fixture.db.query("INSERT INTO profiles(user_id,field,subfield,level) VALUES($1,'sales','sdr_outbound','beginner')",[userId]);
    let time = Date.now();
    const now = () => new Date(time);
    const demo = await catalog.getDemoCase('sales','sdr_outbound');
    const futureDoc = { ...demo.case.docs[0], id: `late-${randomUUID()}`, arrivesAtTurn: 99, title: 'LATE_DOCUMENT_MARKER' };
    const generated = { brief: demo.case.brief, docs: [...demo.case.docs.slice(0,3),futureDoc],
      personas: demo.personas.map((persona) => ({ ...persona,hidden: { ...persona.hidden,realMotive: 'HIDDEN_MOTIVE_MARKER' } })) };
    if (options.twoPersonas) generated.personas.push({ ...generated.personas[0],public: { ...generated.personas[0].public,id: randomUUID(),name: 'Second Persona' } });
    const rubric = { ...demo.rubric, keyMoments: demo.rubric.keyMoments.map((moment) => ({ ...moment,idealMove: 'SECRET_RUBRIC_MARKER' })),
      traps: [{ ...demo.rubric.traps[0],id: 'secret-trap',injectAtCopilotCall: 1,errorToInject: 'The minimum contract is three months.' }],
      twists: options.twists ? [{ id: 'budget-update',documentIds: [futureDoc.id],trigger: { afterUserTurn: 1 },
        event: { kind: 'email',from: 'Finance',content: options.twistContent ?? 'Budget must be approved this week.' } }] : [] };
    const requests: LlmRequest[] = [];
    const llm = createLlmService({ defaultModel: 'test-model',now,recordCall: async () => {},provider: {
      async complete(request) {
        requests.push(request);
        let value: unknown;
        if (request.promptId === 'case.generate') value = generated;
        else if (request.promptId === 'case.rubric') value = rubric;
        else if (options.provider) value = await options.provider(request);
        else if (request.promptId === 'persona.reply') value = personaReply;
        else if (request.promptId === 'copilot.reply') value = { reply: 'Ask about their priorities.' };
        else value = { event: z.object({ twist: DirectorTwist.shape.event }).parse(JSON.parse(request.prompt.split('\n').slice(1).join('\n'))).twist };
        return { text: JSON.stringify(value),model: 'test-model' };
      },
    } });
    const jobs = createJobsService({ db: fixture.db,now });
    const events = createEventsService({ db: fixture.db,now });
    const caseEngine = createCaseEngineService({ db: fixture.db,jobs,llm,catalog,now,canStart: async () => true });
    const { caseId } = await caseEngine.generateCase(userId,options.twoPersonas ? 'weekly' : 'onboarding');
    const job = await jobs.claim('generator',{ caseId });
    if (!job?.leaseToken) throw new Error('Generation job missing');
    await caseEngine.handleGenerateJob(job,{ jobId: job.id,owner: 'generator',token: job.leaseToken });
    const record = await caseEngine.getCaseRecord(caseId);
    if (!record?.brief || !record.rubric || record.isDemo) throw new Error('Expected generated fixture');
    const deps = { db: fixture.db,caseEngine,events,jobs,llm,now,operationLeaseMs: options.leaseMs ?? 120_000 };
    return { userId,caseId,record,requests,events,jobs,caseEngine,now,deps,service: createSimulationService(deps),
      advance(ms: number) { time += ms; },
      move(text = 'What is the impact on the operations team?'): MoveRequest {
        return { clientMsgId: randomUUID(),personaId: record.personas[0].public.id,text,draftId: null };
      },
    };
  }
  function edit(draftId: string, clientAt: string): EditorEvent {
    return { id: randomUUID(),draftId,seq: 1,kind: 'insert',inputMode: 'keyboard',clientAt,rangeStart: 0,rangeEnd: 0,
      insertedText: 'Hello',sourceEventId: null,inputType: 'insertText',isComposing: false,isTrusted: true };
  }

  it('starts only an owned ready case and never resets the server timer', async () => {
    const f = await setup();
    await expect(f.service.startCase(f.caseId,randomUUID())).rejects.toMatchObject({ status: 404 });
    await expect(f.service.handleMove(f.caseId,f.userId,f.move())).rejects.toMatchObject({ status: 409 });
    const first = await f.service.startCase(f.caseId,f.userId);
    f.advance(1000);
    expect(await f.service.startCase(f.caseId,f.userId)).toEqual(first);
    expect((await f.caseEngine.getCaseRecord(f.caseId))?.status).toBe('in_progress');
  });
  it('stores one user draft and response, clamps state, and replays the exact durable result', async () => {
    const f = await setup({ provider: async () => ({ ...personaReply,trustDelta: 20,patienceDelta: 1 }) });
    await f.service.startCase(f.caseId,f.userId);
    await fixture.db.query('UPDATE persona_state SET trust=95,patience=10 WHERE case_id=$1',[f.caseId]);
    const request = { ...f.move('Hello'),draftId: randomUUID() };
    await f.events.appendEditorBatch(f.caseId,f.userId,{ draftId: request.draftId,batchId: randomUUID(),events: [edit(request.draftId,f.now().toISOString())] });
    const response = await f.service.handleMove(f.caseId,f.userId,request);
    expect(response).toMatchObject({ trust: 100,outcome: null,events: [{ actor: 'user',meta: { trustAfter: 100 } },{ actor: 'persona',meta: { typingMs: 900 } }] });
    expect(JSON.stringify(response)).not.toMatch(/PRIVATE_THOUGHT_MARKER|HIDDEN_MOTIVE_MARKER|SECRET_RUBRIC_MARKER/);
    expect(await createSimulationService(f.deps).handleMove(f.caseId,f.userId,request)).toEqual(response);
    expect(f.requests.filter((request) => request.promptId === 'persona.reply')).toHaveLength(1);
    expect((await f.events.listEditorByDraft(f.caseId,f.userId,request.draftId)).messageEventId).toBe(response.events[0].id);
    expect((await f.caseEngine.getCaseRecord(f.caseId))?.personas[0].state).toMatchObject({ turn: 1,trust: 100,patience: 10 });
    await expect(f.service.handleMove(f.caseId,f.userId,{ ...request,text: 'Different' })).rejects.toMatchObject({ status: 409 });
  });
  it('keeps LLM work outside locks and permits only one unfinished action per case', async () => {
    let release!: () => void, entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const held = new Promise<void>((resolve) => { release = resolve; });
    const f = await setup({ provider: async () => { entered(); await held; return personaReply; } });
    await f.service.startCase(f.caseId,f.userId);
    const request = f.move(), pending = f.service.handleMove(f.caseId,f.userId,request);
    await started;
    await fixture.db.transaction(async (tx) => { await tx.query('SELECT id FROM cases WHERE id=$1 FOR UPDATE NOWAIT',[f.caseId]); });
    await expect(f.service.handleMove(f.caseId,f.userId,request)).rejects.toMatchObject({ status: 409 });
    await expect(f.service.handleMove(f.caseId,f.userId,f.move())).rejects.toMatchObject({ status: 409 });
    await expect(f.service.askCopilot(f.caseId,f.userId,{ clientMsgId: randomUUID(),text: 'Help' })).rejects.toMatchObject({ status: 409 });
    await expect(f.service.submitCase(f.caseId,f.userId)).rejects.toMatchObject({ status: 409 });
    release(); await pending;
    expect((await f.events.listByCase(f.caseId)).events.filter((event) => event.actor === 'user')).toHaveLength(1);
  });
  it('recovers a provider failure after a saved persona checkpoint without duplicate calls or twists', async () => {
    let fail = true;
    const f = await setup({ twists: true,provider: async (request) => {
      if (request.promptId === 'persona.reply') return personaReply;
      if (fail) { fail = false; throw new Error('provider unavailable'); }
      return { event: { kind: 'email',from: 'Finance',content: 'Budget must be approved this week.' } };
    } });
    await f.service.startCase(f.caseId,f.userId);
    const request = f.move();
    await expect(f.service.handleMove(f.caseId,f.userId,request)).rejects.toMatchObject({ code: 'LLM_FAILED' });
    expect((await f.events.listByCase(f.caseId)).events).toHaveLength(1);
    const result = await createSimulationService(f.deps).handleMove(f.caseId,f.userId,request);
    expect(result.events.map((event) => event.type)).toEqual(['message','twist','message']);
    expect(f.requests.filter((request) => request.promptId === 'persona.reply')).toHaveLength(1);
    expect((await f.caseEngine.getCaseForUser(f.caseId,f.userId))).toMatchObject({ docs: expect.arrayContaining([expect.objectContaining({ title: 'LATE_DOCUMENT_MARKER',arrivesAtTurn: 1 })]) });
    await f.service.handleMove(f.caseId,f.userId,f.move());
    expect((await f.events.listByCase(f.caseId)).events.filter((event) => event.type === 'twist')).toHaveLength(1);
  });
  it('fences an expired operation lease when the same request is recovered by a new service', async () => {
    let release!: () => void, entered!: () => void, calls = 0;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const held = new Promise<void>((resolve) => { release = resolve; });
    const f = await setup({ leaseMs: 1000,provider: async () => {
      calls++;
      if (calls === 1) { entered(); await held; return { ...personaReply,reply: 'stale reply' }; }
      return { ...personaReply,reply: 'current reply' };
    } });
    await f.service.startCase(f.caseId,f.userId);
    const request = f.move(), old = f.service.handleMove(f.caseId,f.userId,request);
    const oldRejected = expect(old).rejects.toMatchObject({ status: 409 });
    await started; f.advance(1001);
    const current = await createSimulationService(f.deps).handleMove(f.caseId,f.userId,request);
    release(); await oldRejected;
    expect(current.events.at(-1)?.content).toBe('current reply');
    expect(JSON.stringify((await f.events.listByCase(f.caseId)).events)).not.toContain('stale reply');
  });
  it('separates persona and copilot prompt contexts and marks only actually presented trap text', async () => {
    let copilotCalls = 0;
    const f = await setup({ provider: async (request) => request.promptId === 'persona.reply' ? personaReply :
      { reply: ++copilotCalls === 1 ? 'Ask about their priorities.' : 'The minimum contract is three months.' } });
    await f.service.startCase(f.caseId,f.userId);
    const first = { clientMsgId: randomUUID(),text: 'What should I ask?' };
    const answer = await f.service.askCopilot(f.caseId,f.userId,first);
    expect(await f.service.askCopilot(f.caseId,f.userId,first)).toEqual(answer);
    expect((await f.events.listByCase(f.caseId)).events.find((event) => event.type === 'copilot_reply')?.meta.trapId).toBeUndefined();
    // Explicitly exercise a second configured injection rather than treating matching unsolicited text as presented.
    await fixture.db.query("UPDATE rubrics SET traps=jsonb_set(traps,'{0,injectAtCopilotCall}','2') WHERE case_id=$1",[f.caseId]);
    const injected = await f.service.askCopilot(f.caseId,f.userId,{ clientMsgId: randomUUID(),text: 'Check the term' });
    expect(injected.event.meta).toEqual({});
    const saved = (await f.events.listByCase(f.caseId)).events.find((event) => event.id === injected.event.id);
    expect(saved?.meta.trapId).toBe('secret-trap');
    await f.service.handleMove(f.caseId,f.userId,f.move());
    await f.service.handleMove(f.caseId,f.userId,f.move());
    const personaPrompts = f.requests.filter((request) => request.promptId === 'persona.reply').map((request) => request.prompt).join('\n');
    expect(personaPrompts).not.toMatch(/SECRET_RUBRIC_MARKER|PRIVATE_THOUGHT_MARKER|secret-trap|The minimum contract is three months|LATE_DOCUMENT_MARKER/);
    expect(personaPrompts).toContain('HIDDEN_MOTIVE_MARKER');
    const copilotPrompts = f.requests.filter((request) => request.promptId === 'copilot.reply').map((request) => request.prompt).join('\n');
    expect(copilotPrompts).not.toMatch(/HIDDEN_MOTIVE_MARKER|SECRET_RUBRIC_MARKER|PRIVATE_THOUGHT_MARKER|secret-trap|LATE_DOCUMENT_MARKER/);
    expect(copilotPrompts).toContain('The minimum contract is three months.');
  });
  it('uses global user turns across personas and activates a trust-triggered twist exactly once', async () => {
    const f = await setup({ twoPersonas: true,twists: true });
    await fixture.db.query("UPDATE rubrics SET twists=jsonb_set(twists,'{0,trigger}','{\"trustBelow\":99}') WHERE case_id=$1",[f.caseId]);
    await f.service.startCase(f.caseId,f.userId);
    await f.service.handleMove(f.caseId,f.userId,f.move());
    await f.service.handleMove(f.caseId,f.userId,{ ...f.move(),personaId: f.record.personas[1].public.id });
    expect((await f.caseEngine.getCaseRecord(f.caseId))?.personas.map((persona) => persona.state.turn).sort()).toEqual([1,2]);
    expect((await f.events.listByCase(f.caseId)).events.filter((event) => event.type === 'twist')).toHaveLength(1);
  });
  it.each(['won','patience'] as const)('auto-submits terminal %s outcomes once and blocks further actions', async (mode) => {
    const f = await setup({ provider: async () => ({ ...personaReply,patienceDelta: mode === 'patience' ? -3 : 0,outcome: mode === 'won' ? 'won' : null }) });
    await f.service.startCase(f.caseId,f.userId);
    if (mode === 'patience') await fixture.db.query('UPDATE persona_state SET patience=1 WHERE case_id=$1',[f.caseId]);
    const request = f.move(), response = await f.service.handleMove(f.caseId,f.userId,request);
    expect(response.outcome).toBe(mode === 'won' ? 'won' : 'left');
    expect((await f.caseEngine.getCaseRecord(f.caseId))?.status).toBe('submitted');
    expect(await f.service.handleMove(f.caseId,f.userId,request)).toEqual(response);
    expect(await f.service.submitCase(f.caseId,f.userId)).toEqual({ status: 'evaluating' });
    await expect(f.service.handleMove(f.caseId,f.userId,f.move())).rejects.toMatchObject({ status: 409 });
    expect((await fixture.db.query("SELECT id FROM jobs WHERE case_id=$1 AND kind='case.evaluate'",[f.caseId])).rowCount).toBe(1);
  });
  it('freezes all accepted observations and queues evaluation atomically, including guest disclosure', async () => {
    const f = await setup({ guest: true });
    await f.service.startCase(f.caseId,f.userId);
    const draftId = randomUUID();
    await f.events.appendEditorBatch(f.caseId,f.userId,{ draftId,batchId: randomUUID(),events: [edit(draftId,f.now().toISOString())] });
    const failingJobs = { ...f.jobs,async enqueueWithExecutor() { throw new Error('queue unavailable'); } };
    await expect(createSimulationService({ ...f.deps,jobs: failingJobs }).submitCase(f.caseId,f.userId)).rejects.toThrow('queue unavailable');
    expect((await f.caseEngine.getCaseRecord(f.caseId))?.status).toBe('in_progress');
    expect(await f.service.loadSubmission(f.caseId)).toBeNull();
    await f.service.submitCase(f.caseId,f.userId);
    const snapshot = SubmittedSnapshot.parse(await f.service.loadSubmission(f.caseId));
    expect(snapshot).toMatchObject({ version: 1,case: { id: f.caseId,userId: f.userId,isDemo: true,isGuest: true },drafts: [{ draftId,events: [{ insertedText: 'Hello' }] }],reason: 'user' });
    await expect(f.events.appendEditorBatch(f.caseId,f.userId,{ draftId,batchId: randomUUID(),events: [edit(draftId,f.now().toISOString())] })).rejects.toMatchObject({ status: 409 });
    await fixture.db.query("UPDATE cases SET docs='[]' WHERE id=$1",[f.caseId]);
    expect(await f.service.loadSubmission(f.caseId)).toEqual(snapshot);
  });
  it('submits a timeout while an old provider call is pending and fences its late output', async () => {
    let release!: () => void, entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const held = new Promise<void>((resolve) => { release = resolve; });
    const f = await setup({ provider: async () => { entered(); await held; return personaReply; } });
    await f.service.startCase(f.caseId,f.userId);
    const pending = f.service.handleMove(f.caseId,f.userId,f.move());
    const rejected = expect(pending).rejects.toMatchObject({ status: 409 });
    await started; f.advance(481_000);
    await expect(f.service.askCopilot(f.caseId,f.userId,{ clientMsgId: randomUUID(),text: 'Help' })).rejects.toMatchObject({ status: 409 });
    expect((await f.service.loadSubmission(f.caseId))?.reason).toBe('timeout');
    release(); await rejected;
    expect((await f.events.listByCase(f.caseId)).events.filter((event) => event.actor === 'persona')).toHaveLength(0);
  });
  it('limits moves and copilot requests independently without rejecting completed retries', async () => {
    const f = await setup();
    await f.service.startCase(f.caseId,f.userId);
    let request = f.move();
    for (let i=0;i<30;i++) { request = f.move(); await f.service.handleMove(f.caseId,f.userId,request); }
    await expect(f.service.handleMove(f.caseId,f.userId,request)).resolves.toMatchObject({ outcome: null });
    await expect(f.service.handleMove(f.caseId,f.userId,f.move())).rejects.toMatchObject({ code: 'RATE_LIMIT' });
    for (let i=0;i<10;i++) await f.service.askCopilot(f.caseId,f.userId,{ clientMsgId: randomUUID(),text: 'Help' });
    await expect(f.service.askCopilot(f.caseId,f.userId,{ clientMsgId: randomUUID(),text: 'Help' })).rejects.toMatchObject({ code: 'RATE_LIMIT' });
  });
  it('preserves predetermined twist amounts and deadlines when the director changes them', async () => {
    const f = await setup({ twists: true,twistContent: 'The approved budget is $40,000, due Friday.',provider: async (request) =>
      request.promptId === 'persona.reply' ? personaReply : { event: { kind: 'email',from: 'Finance',content: 'The approved budget is $90,000, due Monday.' } } });
    await f.service.startCase(f.caseId,f.userId);
    const response = await f.service.handleMove(f.caseId,f.userId,f.move());
    expect(response.events.find((event) => event.type === 'twist')?.content).toBe('The approved budget is $40,000, due Friday.');
    expect(JSON.stringify((await f.events.listByCase(f.caseId)).events)).not.toContain('$90,000');
  });
});
