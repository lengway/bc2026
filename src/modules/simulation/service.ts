import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { CaseParams, CopilotRequest, CopilotResponse, MoveRequest, MoveResponse, StartCaseResponse, SubmitCaseResponse } from '@/contracts';
import { availableDocuments, type CaseEngineService, type CaseRecord } from '@/modules/case-engine';
import type { Database, SqlExecutor } from '@/modules/database';
import type { EventsService, StoredEvent } from '@/modules/events';
import { consumeRateLimit } from '@/modules/identity';
import type { JobsService } from '@/modules/jobs';
import { CopilotReply, DirectorTwist, PersonaReply, type LlmService } from '@/modules/llm';
import { AppError, systemClock, type Clock } from '@/modules/shared';
import * as repo from './repo';
import { SubmittedSnapshot } from './snapshot';

export interface SimulationDeps {
  db: Database; caseEngine: CaseEngineService; events: EventsService; jobs: JobsService; llm: LlmService;
  now?: Clock; operationLeaseMs?: number;
}
interface Lease { caseId: string; userId: string; clientMsgId: string; token: string; providerAttemptCharged?: boolean }
type ActionResult = MoveResponse | CopilotResponse;
type BeginResult = { response: ActionResult } | { lease: Lease } | { timedOut: true };
const busy = () => new AppError('VALIDATION',409,'An action is unfinished. Retry the same clientMsgId after it finishes or its lease expires.');
const lostLease = () => new AppError('VALIDATION',409,'This action lease is no longer current. Retry the original request.');
const unavailable = () => new AppError('VALIDATION',409,'This case is not accepting actions.');
function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError('VALIDATION',400,'Invalid simulation request.');
  return parsed.data;
}
function currentTurn(record: CaseRecord) { return Math.max(0,...record.personas.map((persona) => persona.state.turn)); }
function safeHistory(events: StoredEvent[], includeCopilot: boolean) {
  return events.filter((event) => event.isPublic && (includeCopilot || (event.actor !== 'copilot' && event.type !== 'copilot_prompt')))
    .map(({ id,seq,actor,personaId,type,content }) => ({ id,seq,actor,personaId,type,content }));
}

export function createSimulationService({ db,caseEngine,events,jobs,llm,now = systemClock,operationLeaseMs = 120_000 }: SimulationDeps) {
  validate(z.int().min(1000).max(900_000),operationLeaseMs);
  function validateCase(caseId: string, userId: string) { validate(CaseParams,{ id: caseId }); validate(z.uuid(),userId); }
  async function lockAndRead(tx: SqlExecutor, caseId: string, userId: string) {
    await repo.lockCase(tx,caseId,userId);
    const record = await caseEngine.getCaseRecord(caseId,{ userId,executor: tx });
    if (!record) throw new AppError('NOT_FOUND',404,'Case not found.');
    return record;
  }
  function timedOut(record: CaseRecord) {
    return record.startedAt !== null && record.timeLimitSec !== null && Date.parse(record.startedAt)+record.timeLimitSec*1000<=now().getTime();
  }
  async function freeze(tx: SqlExecutor, record: CaseRecord, reason: SubmittedSnapshot['reason']) {
    if (record.status === 'submitted' || record.status === 'evaluated') return;
    if (record.status !== 'in_progress' || !record.startedAt || !record.brief || !record.rubric || !record.scoringGuide || !record.timeLimitSec) throw unavailable();
    const instant = now(), open = await repo.readUnfinished(tx,record.id);
    if (open?.status === 'running' && open.lease_expires_at && Date.parse(open.lease_expires_at)>instant.getTime() && reason !== 'timeout') throw busy();
    if (open) await repo.cancelOperation(tx,open,instant);
    await events.appendWithExecutor(tx,record.id,{ actor: 'system',type: 'submit',content: '',
      meta: { reason,...(open ? { incompleteOperationId: open.client_msg_id } : {}) } });
    const guest = await repo.isGuest(tx,record.userId);
    const snapshot = SubmittedSnapshot.parse({
      version: 1,case: { ...record,isDemo: record.isDemo || guest,isGuest: guest },
      events: (await events.listByCaseWithExecutor(tx,record.id)).events,
      drafts: await events.listDraftsByCaseWithExecutor(tx,record.id,record.userId),submittedAt: instant.toISOString(),reason,
      limitations: open ? ['incomplete_simulation_operation'] : [],
    });
    await repo.saveSubmission(tx,snapshot);
    await jobs.enqueueWithExecutor(tx,{ kind: 'case.evaluate',caseId: record.id,dedupeKey: `case.evaluate:${record.id}`,payload: { snapshotVersion: 1 } });
  }
  async function startCase(caseId: string, userId: string): Promise<StartCaseResponse> {
    validateCase(caseId,userId);
    return db.transaction(async (tx) => {
      const record = await lockAndRead(tx,caseId,userId);
      if (record.startedAt && record.status === 'in_progress') return { startedAt: record.startedAt };
      if (record.status !== 'ready' || !record.brief || !record.rubric || !record.timeLimitSec || !record.personas.length) throw unavailable();
      const instant = now();
      await repo.start(tx,caseId,instant);
      return StartCaseResponse.parse({ startedAt: instant.toISOString() });
    });
  }
  async function begin(caseId: string, userId: string, kind: 'move'|'copilot', request: MoveRequest|CopilotRequest): Promise<BeginResult> {
    return db.transaction(async (tx) => {
      const record = await lockAndRead(tx,caseId,userId);
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,2))',[request.clientMsgId]);
      const prior = await repo.readOperation(tx,request.clientMsgId);
      if (prior && (prior.case_id !== caseId || prior.user_id !== userId)) throw new AppError('NOT_FOUND',404,'Action not found.');
      if (prior && (prior.kind !== kind || !isDeepStrictEqual(prior.request,request))) throw new AppError('VALIDATION',409,'The clientMsgId was already used for a different action.');
      if (prior?.status === 'completed' && prior.response) return { response: prior.response };
      if (record.status !== 'in_progress' || !record.startedAt || !record.rubric) throw unavailable();
      if (timedOut(record)) { await freeze(tx,record,'timeout'); return { timedOut: true }; }
      if (record.personas.some((persona) => persona.state.outcome !== null || persona.state.patience<=0)) {
        await freeze(tx,record,'outcome'); return { timedOut: true };
      }
      const open = await repo.readUnfinished(tx,caseId);
      if (open && open.client_msg_id !== request.clientMsgId) throw busy();
      if (prior?.status === 'cancelled') throw unavailable();
      if (prior?.status === 'running' && prior.lease_expires_at && Date.parse(prior.lease_expires_at)>now().getTime()) throw busy();
      if (kind === 'move' && (!('personaId' in request) || !record.personas.some((persona) => persona.public.id === request.personaId)))
        throw new AppError('NOT_FOUND',404,'Persona not found.');
      if (!prior) {
        await consumeRateLimit(tx,`simulation:${kind}:${caseId}`,kind === 'move' ? 30 : 10,60_000,now());
        const inputEvent = await events.appendWithExecutor(tx,caseId,{
          actor: 'user',type: kind === 'move' ? 'message' : 'copilot_prompt',content: request.text,clientMsgId: request.clientMsgId,
          personaId: 'personaId' in request ? request.personaId : null,draftId: 'draftId' in request ? request.draftId : null,
          meta: { operationId: request.clientMsgId,userTurn: currentTurn(record)+(kind === 'move' ? 1 : 0),
            availableDocumentIds: availableDocuments(record).map((doc) => doc.id) },
        });
        await repo.insertOperation(tx,caseId,userId,kind,request,inputEvent.id,now());
      }
      const token = randomUUID();
      await repo.claimOperation(tx,request.clientMsgId,token,new Date(now().getTime()+operationLeaseMs),now());
      return { lease: { caseId,userId,clientMsgId: request.clientMsgId,token } };
    });
  }
  async function withLease<T>(lease: Lease, work: (tx: SqlExecutor, record: CaseRecord, operation: repo.Operation) => Promise<T>): Promise<T> {
    const result = await db.transaction(async (tx): Promise<{ ok: true; value: T }|{ ok: false }> => {
      const record = await lockAndRead(tx,lease.caseId,lease.userId);
      if (record.status !== 'in_progress') throw lostLease();
      if (timedOut(record)) { await freeze(tx,record,'timeout'); return { ok: false }; }
      const operation = await repo.readOperation(tx,lease.clientMsgId);
      if (!operation || operation.status !== 'running' || operation.lease_token !== lease.token || !operation.lease_expires_at || Date.parse(operation.lease_expires_at)<=now().getTime()) throw lostLease();
      return { ok: true,value: await work(tx,record,operation) };
    });
    if (!result.ok) throw unavailable();
    return result.value;
  }
  async function stage<T>(lease: Lease, promptId: string, input: Record<string,unknown>, schema: z.ZodType<T>, merge: (checkpoint: repo.Checkpoint, data: T) => repo.Checkpoint): Promise<T> {
    await withLease(lease,async (tx,_record,operation) => {
      // A resumed action can spend provider resources again even though its user event
      // already exists. Charge once per lease only when a missing stage needs the LLM;
      // saved-result replays and checkpoint-only publication never enter this path.
      if (!lease.providerAttemptCharged) await consumeRateLimit(tx,`simulation:attempt:${operation.kind}:${lease.caseId}`,
        operation.kind === 'move' ? 30 : 10,60_000,now());
      await repo.writeCheckpoint(tx,operation,operation.checkpoint,new Date(now().getTime()+operationLeaseMs),now());
    });
    lease.providerAttemptCharged = true;
    let data: T;
    try { data = (await llm.run(promptId,input,schema,{ caseId: lease.caseId })).data; }
    catch { throw new AppError('LLM_FAILED',502,'The simulation response is unavailable. Retry the same clientMsgId.'); }
    await withLease(lease,async (tx,_record,operation) => {
      await repo.writeCheckpoint(tx,operation,merge(operation.checkpoint,data),new Date(now().getTime()+operationLeaseMs),now());
    });
    return data;
  }
  async function context(lease: Lease) {
    return withLease(lease,async (tx,record,operation) => ({ record,operation,history: (await events.listByCaseWithExecutor(tx,record.id)).events }));
  }
  async function move(lease: Lease): Promise<MoveResponse> {
    const initial = await context(lease), request = MoveRequest.parse(initial.operation.request);
    const persona = initial.record.personas.find((item) => item.public.id === request.personaId);
    if (!persona || !initial.record.rubric) throw unavailable();
    const reply = initial.operation.checkpoint.personaReply ?? await stage(lease,'persona.reply',{
      persona: persona.public,hidden: persona.hidden,state: persona.state,history: safeHistory(initial.history,false),availableDocs: availableDocuments(initial.record),
    },PersonaReply.refine((reply) => reply.reply.length<=32_000 && reply.typingMs<=120_000,'Reply is too large'),(checkpoint,personaReply) => ({ ...checkpoint,personaReply }));
    const trust = Math.min(100,Math.max(0,persona.state.trust+reply.trustDelta));
    const patience = Math.min(10,Math.max(0,persona.state.patience+reply.patienceDelta));
    const outcome = patience === 0 ? 'left' as const : reply.outcome;
    const turn = currentTurn(initial.record)+1;
    const fired = new Set(initial.history.filter((event) => event.type === 'twist').map((event) => event.meta.twistId));
    const selected = initial.record.rubric.twists.filter((twist,index,array) => array.findIndex((item) => item.id === twist.id) === index && !fired.has(twist.id) &&
      ('afterUserTurn' in twist.trigger ? turn>=twist.trigger.afterUserTurn : trust<twist.trigger.trustBelow));
    for (const twist of selected) {
      const checkpoint = (await context(lease)).operation.checkpoint;
      if (checkpoint.twists.some((saved) => saved.id === twist.id)) continue;
      await stage(lease,'director.twist',{
        twist: twist.event,context: { turn,history: safeHistory(initial.history,false),personas: initial.record.personas.map((item) => item.public) },
      },DirectorTwist.refine(({ event }) => event.kind === twist.event.kind && event.from === twist.event.from && event.content.length<=32_000,
        'Preserve the triggered twist kind and sender'),(saved,result) => ({ ...saved,twists: [...saved.twists,{
          id: twist.id,event: { ...result.event,content: result.event.content.includes(twist.event.content) ? result.event.content : twist.event.content },
        }] }));
    }
    return withLease(lease,async (tx,record,operation) => {
      const userEvent = await events.setTrustAfterWithExecutor(tx,record.id,operation.input_event_id,trust);
      await repo.writePersonaState(tx,record.id,persona.public.id,{ ...persona.state,turn,trust,patience,outcome,
        revealed: [...new Set([...persona.state.revealed,...reply.revealed])] },now());
      const responseEvents = [userEvent];
      let docs = record.docs;
      for (const twist of selected) {
        const formatted = operation.checkpoint.twists.find((item) => item.id === twist.id);
        if (!formatted) throw new Error('Missing persisted twist response');
        const documentIds: string[] = [];
        docs = docs.map((doc) => {
          if (!twist.documentIds.includes(doc.id) || doc.arrivesAtTurn === null || doc.arrivesAtTurn<=turn) return doc;
          documentIds.push(doc.id); return { ...doc,arrivesAtTurn: Math.min(doc.arrivesAtTurn,turn) };
        });
        responseEvents.push(await events.appendWithExecutor(tx,record.id,{ actor: 'system',type: 'twist',content: formatted.event.content,
          meta: { twistId: twist.id,documentIds,kind: formatted.event.kind,from: formatted.event.from } }));
      }
      await repo.writeDocuments(tx,record.id,docs);
      responseEvents.push(await events.appendWithExecutor(tx,record.id,{ actor: 'persona',personaId: persona.public.id,type: 'message',content: reply.reply,
        meta: { typingMs: reply.typingMs,trustAfter: trust,innerThought: reply.innerThought,replyToEventId: operation.input_event_id } }));
      const response = MoveResponse.parse({ events: responseEvents.map(events.toPublicEvent),trust,outcome });
      await repo.completeOperation(tx,operation,response,now());
      if (outcome !== null) {
        const updated = await caseEngine.getCaseRecord(record.id,{ executor: tx });
        if (!updated) throw new Error('Case disappeared during response publication');
        await freeze(tx,updated,'outcome');
      }
      return response;
    });
  }
  async function copilot(lease: Lease): Promise<CopilotResponse> {
    const initial = await context(lease), request = CopilotRequest.parse(initial.operation.request);
    if (!initial.record.rubric) throw unavailable();
    const callNumber = initial.history.filter((event) => event.type === 'copilot_prompt').length;
    const trap = initial.record.rubric.traps.find((item) => item.injectAtCopilotCall === callNumber);
    const reply = initial.operation.checkpoint.copilotReply ?? await stage(lease,'copilot.reply',{
      history: safeHistory(initial.history,true),docs: availableDocuments(initial.record),request: request.text,...(trap ? { inject: trap.errorToInject } : {}),
    },CopilotReply.refine((reply) => reply.reply.length<=32_000,'Reply is too large'),(checkpoint,copilotReply) => ({ ...checkpoint,copilotReply }));
    return withLease(lease,async (tx,record,operation) => {
      const presented = trap !== undefined && reply.reply.includes(trap.errorToInject);
      const replyEvent = await events.appendWithExecutor(tx,record.id,{ actor: 'copilot',type: 'copilot_reply',content: reply.reply,
        meta: { promptEventId: operation.input_event_id,...(presented ? { trapId: trap.id,trapPresented: true } : {}) } });
      const response = CopilotResponse.parse({ event: events.toPublicEvent(replyEvent) });
      await repo.completeOperation(tx,operation,response,now());
      return response;
    });
  }
  async function action(caseId: string, userId: string, kind: 'move'|'copilot', request: MoveRequest|CopilotRequest): Promise<ActionResult> {
    const begun = await begin(caseId,userId,kind,request);
    if ('response' in begun) return begun.response;
    if ('timedOut' in begun) throw unavailable();
    const lease = begun.lease;
    try { return kind === 'move' ? await move(lease) : await copilot(lease); }
    catch (error) {
      await db.transaction(async (tx) => { await repo.lockCase(tx,caseId,userId); await repo.releaseOperation(tx,lease.clientMsgId,lease.token,now()); });
      throw error;
    }
  }
  return {
    startCase,
    async handleMove(caseId: string, userId: string, input: MoveRequest): Promise<MoveResponse> {
      validateCase(caseId,userId);
      return MoveResponse.parse(await action(caseId,userId,'move',validate(MoveRequest,input)));
    },
    async askCopilot(caseId: string, userId: string, input: CopilotRequest): Promise<CopilotResponse> {
      validateCase(caseId,userId);
      return CopilotResponse.parse(await action(caseId,userId,'copilot',validate(CopilotRequest,input)));
    },
    async submitCase(caseId: string, userId: string): Promise<SubmitCaseResponse> {
      validateCase(caseId,userId);
      await db.transaction(async (tx) => {
        const record = await lockAndRead(tx,caseId,userId);
        await freeze(tx,record,timedOut(record) ? 'timeout' : 'user');
      });
      return { status: 'evaluating' };
    },
    loadSubmission: (caseId: string) => { validate(CaseParams,{ id: caseId }); return repo.loadSubmission(db,caseId); },
  };
}
export type SimulationService = ReturnType<typeof createSimulationService>;
