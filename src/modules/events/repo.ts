import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { EditorBatch, EditorBatchAck, EditorEvent, Event, EventActor, EventType, InteractionWindow, PublicEventMeta } from '@/contracts';
import type { Database, SqlExecutor } from '@/modules/database';
import { AppError } from '@/modules/shared';

const DateValue = z.union([z.date(), z.iso.datetime({ offset: true })]).transform((value) => new Date(value).toISOString());
const Stored = Event.omit({ meta: true }).extend({ meta: z.record(z.string(), z.json()), isPublic: z.boolean() });
export type StoredEvent = z.infer<typeof Stored>;
const Append = z.object({
  actor: EventActor, type: EventType, content: z.string().max(32_000), personaId: z.string().max(128).nullable().default(null),
  meta: z.record(z.string(), z.json()).default({}), clientMsgId: z.uuid().nullable().default(null),
  draftId: z.uuid().nullable().default(null), isPublic: z.boolean().default(true),
});
export type AppendEvent = z.input<typeof Append>;
const Draft = z.object({
  id: z.uuid(), case_id: z.uuid(), user_id: z.uuid(), message_event_id: z.uuid().nullable(),
  closed_at: DateValue.nullable(), observation_limitations: z.array(z.string()),
});
const CaseRow = z.object({ id: z.uuid(), user_id: z.uuid(), status: z.string(), started_at: DateValue.nullable(),
  time_limit_sec: z.int().positive().nullable(), last_event_seq: z.int().nonnegative() });
const EventRow = z.object({
  id: z.uuid(), case_id: z.uuid(), seq: z.int().positive(), actor: EventActor, persona_id: z.string().nullable(), type: EventType,
  content: z.string(), meta: z.record(z.string(), z.json()), is_public: z.boolean(), client_msg_id: z.uuid().nullable(),
  draft_id: z.uuid().nullable(), created_at: DateValue,
});
const EditorRow = z.object({ payload: EditorEvent, received_at: DateValue });
export type StoredEditorEvent = EditorEvent & { receivedAt: string };
export interface DraftObservations {
  draftId: string; messageEventId: string | null; closedAt: string | null; limitations: string[];
  events: StoredEditorEvent[]; interactionWindows: (InteractionWindow & { receivedAt: string })[];
}
const invalid = (message: string, status = 400) => new AppError('VALIDATION', status, message);
const missing = () => new AppError('NOT_FOUND', 404, 'Case or draft not found');
function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalid('Invalid event input');
  return parsed.data;
}
function stored(row: Record<string, unknown>): StoredEvent {
  const value = EventRow.parse(row);
  return Stored.parse({ id: value.id, caseId: value.case_id, seq: value.seq, actor: value.actor, personaId: value.persona_id,
    type: value.type, content: value.content, meta: value.meta, isPublic: value.is_public,
    clientMsgId: value.client_msg_id, draftId: value.draft_id, createdAt: value.created_at });
}
export function toPublicEvent(event: StoredEvent): Event {
  if (!event.isPublic) throw invalid('Private event cannot be projected');
  return Event.parse({ ...event, meta: PublicEventMeta.parse(event.meta) });
}

export function createEventsService({ db, now = () => new Date() }: { db: Database; now?: () => Date }) {
  async function lockCase(tx: SqlExecutor, caseId: string, userId?: string) {
    validate(z.uuid(), caseId);
    const row = (await tx.query('SELECT id,user_id,status,started_at,time_limit_sec,last_event_seq FROM cases WHERE id=$1 FOR UPDATE', [caseId])).rows[0];
    if (!row) throw missing();
    const result = CaseRow.parse(row);
    if (userId && result.user_id !== userId) throw missing();
    return result;
  }
  /** The caller must hold the case lock before binding a draft. No lock spans external work. */
  async function bindDraftWithExecutor(tx: SqlExecutor, caseId: string, userId: string, draftId: string) {
    validate(z.uuid(), draftId);
    await lockCase(tx, caseId, userId);
    await tx.query(`INSERT INTO editor_drafts(id,case_id,user_id,created_at) VALUES ($1,$2,$3,$4)
      ON CONFLICT(id) DO NOTHING`, [draftId, caseId, userId, now()]);
    const draft = Draft.parse((await tx.query('SELECT * FROM editor_drafts WHERE id=$1 FOR UPDATE', [draftId])).rows[0]);
    if (draft.case_id !== caseId || draft.user_id !== userId) throw missing();
    return draft;
  }
  async function draftObservations(tx: SqlExecutor, caseId: string, userId: string, draftId: string): Promise<DraftObservations> {
    const row = (await tx.query('SELECT * FROM editor_drafts WHERE id=$1 AND case_id=$2 AND user_id=$3', [draftId,caseId,userId])).rows[0];
    if (!row) throw missing();
    const draft = Draft.parse(row);
    const events = z.array(EditorRow).parse((await tx.query('SELECT payload,received_at FROM editor_events WHERE draft_id=$1 ORDER BY seq', [draftId])).rows)
      .map(({ payload, received_at }) => ({ ...payload, receivedAt: received_at }));
    const windows = z.array(z.object({ metrics: InteractionWindow, received_at: DateValue })).parse(
      (await tx.query('SELECT metrics,received_at FROM interaction_windows WHERE draft_id=$1 ORDER BY started_at,id', [draftId])).rows,
    ).map(({ metrics, received_at }) => ({ ...metrics, receivedAt: received_at }));
    return { draftId, messageEventId: draft.message_event_id, closedAt: draft.closed_at,
      limitations: draft.observation_limitations, events, interactionWindows: windows };
  }
  async function closeDraftWithExecutor(tx: SqlExecutor, caseId: string, userId: string, draftId: string, messageEventId: string) {
    const draft = await bindDraftWithExecutor(tx, caseId, userId, draftId);
    if (draft.closed_at && draft.message_event_id !== messageEventId) throw invalid('Draft has already been submitted', 409);
    const message = (await tx.query("SELECT content FROM events WHERE id=$1 AND case_id=$2 AND draft_id=$3 AND actor='user' AND type='message'", [messageEventId,caseId,draftId])).rows[0];
    if (!message) throw invalid('Draft can only close against its user message');
    const content = z.object({ content: z.string() }).parse(message).content;
    const observations = await draftObservations(tx, caseId, userId, draftId);
    const limitations = new Set(observations.limitations);
    if (!observations.events.length) limitations.add('telemetry_unavailable');
    let text = '', expectedSeq = 1, reconstructable = true;
    for (const event of observations.events) {
      if (event.seq !== expectedSeq) { limitations.add('sequence_gap'); reconstructable = false; }
      if (event.rangeEnd > text.length) { limitations.add('range_unverifiable'); reconstructable = false; }
      if (reconstructable) text = text.slice(0,event.rangeStart) + event.insertedText + text.slice(event.rangeEnd);
      expectedSeq = event.seq + 1;
    }
    if (observations.events.length && reconstructable && text !== content) limitations.add('final_text_mismatch');
    await tx.query('UPDATE editor_drafts SET message_event_id=$2,closed_at=COALESCE(closed_at,$3),observation_limitations=$4 WHERE id=$1',
      [draftId,messageEventId,now(),[...limitations]]);
  }
  async function appendWithExecutor(tx: SqlExecutor, caseId: string, input: AppendEvent): Promise<StoredEvent> {
    const value = validate(Append, input);
    const owner = await lockCase(tx, caseId);
    if (value.clientMsgId) {
      // Serializes globally unique client ids even when requests target different cases.
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [value.clientMsgId]);
      const existing = (await tx.query('SELECT * FROM events WHERE client_msg_id=$1', [value.clientMsgId])).rows[0];
      if (existing) {
        const event = stored(existing);
        const original = Append.parse(event);
        if (event.caseId !== caseId || !isDeepStrictEqual(original, value)) throw invalid('Client message id was already used', 409);
        return event;
      }
    }
    if (value.draftId) {
      if (value.actor !== 'user' || value.type !== 'message') throw invalid('Only user messages may bind a draft');
      const draft = await bindDraftWithExecutor(tx, caseId, owner.user_id, value.draftId);
      if (draft.closed_at) throw invalid('Draft has already been submitted', 409);
    }
    const next = z.object({ last_event_seq: z.int().positive() }).parse((await tx.query(
      'UPDATE cases SET last_event_seq=last_event_seq+1 WHERE id=$1 RETURNING last_event_seq', [caseId],
    )).rows[0]).last_event_seq;
    const row = (await tx.query(`INSERT INTO events(id,case_id,seq,actor,persona_id,type,content,meta,client_msg_id,draft_id,is_public,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [randomUUID(),caseId,next,value.actor,value.personaId,value.type,value.content,JSON.stringify(value.meta),value.clientMsgId,value.draftId,value.isPublic,now()])).rows[0];
    const event = stored(row);
    if (value.draftId) await closeDraftWithExecutor(tx, caseId, owner.user_id, value.draftId, event.id);
    return event;
  }
  async function listByCaseWithExecutor(executor: SqlExecutor, caseId: string, afterSeq = 0) {
    validate(z.uuid(), caseId); validate(z.int().nonnegative(), afterSeq);
    // One statement takes a consistent snapshot of both records and the cursor.
    const rows = await executor.query(`SELECT c.last_event_seq,e.* FROM cases c LEFT JOIN events e
      ON e.case_id=c.id AND e.seq>$2 WHERE c.id=$1 ORDER BY e.seq`, [caseId,afterSeq]);
    if (!rows.rows.length) throw missing();
    const lastSeq = z.object({ last_event_seq: z.int().nonnegative() }).parse(rows.rows[0]).last_event_seq;
    return { events: rows.rows.filter((row) => row.id !== null).map(stored), lastSeq };
  }
  async function appendEditorBatch(caseId: string, userId: string, input: EditorBatch): Promise<EditorBatchAck> {
    if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 256 * 1024) throw invalid('Editor batch exceeds size limit', 413);
    const batch = validate(EditorBatch, input);
    const hash = createHash('sha256').update(JSON.stringify(batch)).digest('hex');
    return db.transaction(async (tx) => {
      const owner = await lockCase(tx, caseId, userId);
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,1))', [batch.batchId]);
      const existing = (await tx.query('SELECT case_id,user_id,draft_id,payload_hash,ack FROM editor_batches WHERE batch_id=$1', [batch.batchId])).rows[0];
      if (existing) {
        const prior = z.object({ case_id: z.uuid(), user_id: z.uuid(), draft_id: z.uuid(), payload_hash: z.string(), ack: EditorBatchAck }).parse(existing);
        if (prior.case_id !== caseId || prior.user_id !== userId || prior.draft_id !== batch.draftId) throw missing();
        if (prior.payload_hash !== hash) throw invalid('Batch id was already used', 409);
        return prior.ack;
      }
      if (owner.status !== 'in_progress') throw invalid('Case is not active', 409);
      const received = now();
      if (owner.started_at && owner.time_limit_sec && Date.parse(owner.started_at)+owner.time_limit_sec*1000<=received.getTime())
        throw invalid('Case time limit has elapsed',409);
      const draft = await bindDraftWithExecutor(tx, caseId, userId, batch.draftId);
      if (draft.closed_at) throw invalid('Draft has already been submitted', 409);
      const count = z.object({ count: z.int().nonnegative() }).parse((await tx.query(
        'SELECT count(*)::int AS count FROM editor_batches WHERE case_id=$1 AND received_at>$2', [caseId,new Date(received.getTime()-60_000)],
      )).rows[0]).count;
      if (count >= 30) throw new AppError('RATE_LIMIT',429,'Too many editor batches');
      const existingEvents = z.array(EditorRow).parse((await tx.query('SELECT payload,received_at FROM editor_events WHERE draft_id=$1 ORDER BY seq', [batch.draftId])).rows);
      let lastSeq = existingEvents.at(-1)?.payload.seq ?? 0, acceptedCount = 0, acceptedWindowCount = 0;
      const limitations = new Set(draft.observation_limitations);
      const lowerTime = owner.started_at ? Date.parse(owner.started_at)-300_000 : received.getTime()-86_400_000;
      const validTime = (timestamp: string) => Date.parse(timestamp) >= lowerTime && Date.parse(timestamp) <= received.getTime()+30_000;
      for (const event of batch.events) {
        if (!validTime(event.clientAt) || event.rangeEnd > 32_000 || event.seq > 1_000_000) throw invalid('Editor event is outside supported bounds');
        if (event.kind === 'copilot_insert' && !event.sourceEventId) throw invalid('Copilot insertion requires a source');
        if (event.sourceEventId) {
          // Existence and ordering are ingestion checks only. Evaluation must still compare
          // insertedText with the saved source before counting known copilot provenance.
          const sourceRow = (await tx.query("SELECT * FROM events WHERE id=$1 AND case_id=$2 AND actor='copilot' AND type='copilot_reply' AND is_public=true", [event.sourceEventId,caseId])).rows[0];
          if (!sourceRow || Date.parse(stored(sourceRow).createdAt) > Date.parse(event.clientAt)) throw invalid('Invalid editor source');
        }
        const inserted = await tx.query(`INSERT INTO editor_events(id,case_id,user_id,draft_id,seq,kind,input_mode,payload,client_at,received_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING id`,
        [event.id,caseId,userId,batch.draftId,event.seq,event.kind,event.inputMode,JSON.stringify(event),event.clientAt,received]);
        if (!inserted.rowCount) {
          const prior = z.array(z.object({ case_id: z.uuid(), user_id: z.uuid(), draft_id: z.uuid(), payload: EditorEvent })).parse((await tx.query(
            'SELECT case_id,user_id,draft_id,payload FROM editor_events WHERE id=$1 OR (draft_id=$2 AND seq=$3)', [event.id,batch.draftId,event.seq],
          )).rows);
          if (prior.length !== 1 || prior[0].case_id !== caseId || prior[0].user_id !== userId || !isDeepStrictEqual(prior[0].payload,event))
            throw invalid('Editor event id or sequence was already used',409);
          continue;
        }
        if (event.seq !== lastSeq+1) limitations.add('sequence_gap');
        if (event.seq <= lastSeq) limitations.add('out_of_order_events');
        lastSeq = Math.max(lastSeq,event.seq); acceptedCount++;
      }
      for (const window of batch.interactionWindows ?? []) {
        if (!validTime(window.startedAt) || !validTime(window.endedAt) || window.durationMs > 10_250 ||
          Math.abs(Date.parse(window.endedAt)-Date.parse(window.startedAt)-window.durationMs)>250)
          throw invalid('Interaction window is outside supported bounds');
        if (window.pointerMoveSamples !== null && window.pointerMoveSamples>Math.ceil(window.durationMs/100)+1)
          throw invalid('Interaction window exceeds pointer sampling limit');
        const counts = [window.pointerDownCount,window.clickCount,window.wheelCount,window.directionChanges,window.editCount,
          window.focusTransitionCount,window.trustedEventCount,window.untrustedEventCount,
          window.movementIntervalSummary?.sampleCount,window.inputIntervalSummary?.sampleCount];
        if (counts.some((count) => count != null && count>10_000) ||
          (window.pathLengthNormalized !== null && window.pathLengthNormalized>10_000))
          throw invalid('Interaction metrics exceed supported bounds');
        const inserted = await tx.query(`INSERT INTO interaction_windows(id,case_id,user_id,draft_id,started_at,ended_at,received_at,metrics)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING RETURNING id`,
        [window.id,caseId,userId,batch.draftId,window.startedAt,window.endedAt,received,JSON.stringify(window)]);
        if (!inserted.rowCount) {
          const prior = z.object({ case_id: z.uuid(), user_id: z.uuid(), draft_id: z.uuid(), metrics: InteractionWindow }).parse(
            (await tx.query('SELECT case_id,user_id,draft_id,metrics FROM interaction_windows WHERE id=$1', [window.id])).rows[0],
          );
          if (prior.case_id !== caseId || prior.user_id !== userId || prior.draft_id !== batch.draftId || !isDeepStrictEqual(prior.metrics,window))
            throw invalid('Interaction window id was already used',409);
        } else acceptedWindowCount++;
      }
      await tx.query('UPDATE editor_drafts SET observation_limitations=$2 WHERE id=$1', [batch.draftId,[...limitations]]);
      const ack = { acceptedCount, acceptedWindowCount, lastDraftSeq: lastSeq };
      await tx.query(`INSERT INTO editor_batches(batch_id,draft_id,case_id,user_id,payload_hash,ack,received_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [batch.batchId,batch.draftId,caseId,userId,hash,JSON.stringify(ack),received]);
      return ack;
    });
  }
  return {
    append: (caseId: string, input: AppendEvent) => db.transaction((tx) => appendWithExecutor(tx,caseId,input)),
    appendWithExecutor, listByCase: (caseId: string, afterSeq = 0) => listByCaseWithExecutor(db,caseId,afterSeq),
    listByCaseWithExecutor, appendEditorBatch, toPublicEvent, bindDraftWithExecutor, closeDraftWithExecutor,
    async listDraftsByCaseWithExecutor(tx: SqlExecutor, caseId: string, userId: string) {
      const ids = z.array(z.object({ id: z.uuid() })).parse((await tx.query(
        'SELECT id FROM editor_drafts WHERE case_id=$1 AND user_id=$2 ORDER BY created_at,id',[caseId,userId],
      )).rows);
      const drafts: DraftObservations[] = [];
      for (const { id } of ids) drafts.push(await draftObservations(tx,caseId,userId,id));
      return drafts;
    },
    async setTrustAfterWithExecutor(tx: SqlExecutor, caseId: string, eventId: string, trust: number) {
      validate(z.int().min(0).max(100),trust);
      await lockCase(tx,caseId);
      const result = await tx.query(`UPDATE events SET meta=jsonb_set(meta,'{trustAfter}',$3::jsonb)
        WHERE case_id=$1 AND id=$2 AND actor='user' AND type='message' RETURNING *`,[caseId,eventId,JSON.stringify(trust)]);
      if (!result.rows[0]) throw missing();
      return stored(result.rows[0]);
    },
    async listPublicByCase(caseId: string, afterSeq = 0) {
      const page = await listByCaseWithExecutor(db,caseId,afterSeq);
      return { events: page.events.filter((event) => event.isPublic).map(toPublicEvent), lastSeq: page.lastSeq };
    },
    listEditorByDraft: (caseId: string, userId: string, draftId: string) => draftObservations(db,caseId,userId,draftId),
    listEditorByDraftWithExecutor: draftObservations,
  };
}
export type EventsService = ReturnType<typeof createEventsService>;
