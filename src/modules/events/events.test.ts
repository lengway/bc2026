import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EditorBatch, EditorEvent, InteractionWindow } from '@/contracts';
import { createTestDatabase } from '../../../tests/backend/db-helper';
import { createEventsService } from './index';

describe('private PostgreSQL event journal', () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
  const clock = new Date('2026-11-14T12:00:00.000Z');
  beforeAll(async () => { fixture = await createTestDatabase(); });
  afterAll(async () => { await fixture?.cleanup(); });
  async function setup() {
    const userId = randomUUID(), caseId = randomUUID();
    await fixture.db.query('INSERT INTO users(id,email) VALUES ($1,$2)', [userId, `${userId}@example.test`]);
    await fixture.db.query(`INSERT INTO cases(id,user_id,field,subfield,type,workspace,status,started_at)
      VALUES ($1,$2,'sales','sdr_outbound','onboarding','chat','in_progress',$3)`, [caseId, userId, new Date(clock.getTime() - 60_000)]);
    return { userId, caseId, service: createEventsService({ db: fixture.db, now: () => clock }) };
  }
  function edit(draftId: string, overrides: Partial<EditorEvent> = {}): EditorEvent {
    return { id: randomUUID(), draftId, seq: 1, kind: 'insert', inputMode: 'keyboard', clientAt: clock.toISOString(),
      rangeStart: 0, rangeEnd: 0, insertedText: 'Hello', sourceEventId: null,
      inputType: 'insertText', isComposing: false, isTrusted: true, ...overrides };
  }
  function window(): InteractionWindow {
    return { id: randomUUID(), startedAt: new Date(clock.getTime() - 10_000).toISOString(), endedAt: clock.toISOString(),
      durationMs: 10_000, pointerTypes: [], pointerMoveSamples: null, pointerDownCount: null, clickCount: null,
      wheelCount: null, pathLengthNormalized: null, directionChanges: null, movementIntervalSummary: null,
      inputIntervalSummary: null, editCount: 1, focusTransitionCount: 0, visibleDurationMs: 10_000,
      trustedEventCount: 1, untrustedEventCount: 0, webdriverReported: null, capabilityGaps: ['pointer_not_observed'] };
  }
  it('allocates consecutive sequence numbers under concurrent appends', async () => {
    const { caseId, service } = await setup();
    await Promise.all(Array.from({ length: 12 }, (_, i) => service.append(caseId, { actor: 'system', type: 'twist', content: String(i) })));
    const page = await service.listByCase(caseId);
    expect(page.events.map((event) => event.seq)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12]);
    expect(page.lastSeq).toBe(12);
  });
  it('replays a client message once and rejects conflicting reuse', async () => {
    const { caseId, service } = await setup();
    const request = { actor: 'user' as const, type: 'message' as const, content: 'Hi', clientMsgId: randomUUID() };
    const [a, b] = await Promise.all([service.append(caseId, request), service.append(caseId, request)]);
    expect(a.id).toBe(b.id);
    await expect(service.append(caseId, { ...request, content: 'changed' })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect((await service.listByCase(caseId)).lastSeq).toBe(1);
  });
  it('projects only public metadata and advances cursors over private records', async () => {
    const { caseId, service } = await setup();
    const event = await service.append(caseId, { actor: 'persona', type: 'message', content: 'Hello',
      meta: { typingMs: 300, trustAfter: 50, innerThought: 'secret', trapId: 'secret' } });
    await service.append(caseId, { actor: 'system', type: 'twist', content: 'private', isPublic: false });
    expect(service.toPublicEvent(event).meta).toEqual({ typingMs: 300, trustAfter: 50 });
    expect(await service.listPublicByCase(caseId)).toMatchObject({ events: [{ content: 'Hello' }], lastSeq: 2 });
    expect((await service.listPublicByCase(caseId, 1)).events).toEqual([]);
  });
  it('rolls back transaction appends together with caller state', async () => {
    const { caseId, service } = await setup();
    await expect(fixture.db.transaction(async (tx) => {
      await service.appendWithExecutor(tx, caseId, { actor: 'system', type: 'submit', content: '' });
      throw new Error('abort');
    })).rejects.toThrow('abort');
    expect((await service.listByCase(caseId)).lastSeq).toBe(0);
  });
  it('deduplicates batches, event ids/sequences and window ids without inflating counts', async () => {
    const { caseId, userId, service } = await setup();
    const draftId = randomUUID();
    const batch: EditorBatch = { draftId, batchId: randomUUID(), events: [edit(draftId)], interactionWindows: [window()] };
    const ack = await service.appendEditorBatch(caseId, userId, batch);
    expect(ack).toEqual({ acceptedCount: 1, acceptedWindowCount: 1, lastDraftSeq: 1 });
    expect(await service.appendEditorBatch(caseId, userId, batch)).toEqual(ack);
    expect(await service.appendEditorBatch(caseId, userId, { ...batch, batchId: randomUUID() }))
      .toEqual({ acceptedCount: 0, acceptedWindowCount: 0, lastDraftSeq: 1 });
    const draft = await service.listEditorByDraft(caseId, userId, draftId);
    expect(draft.events).toHaveLength(1);
    expect(draft.interactionWindows).toHaveLength(1);
    expect(draft.events[0].receivedAt).toBe(clock.toISOString());
  });
  it('binds windows-only drafts and rejects cross-owner or cross-case reuse', async () => {
    const a = await setup(), b = await setup();
    const draftId = randomUUID();
    const batch = { draftId, batchId: randomUUID(), events: [], interactionWindows: [window()] };
    await a.service.appendEditorBatch(a.caseId, a.userId, batch);
    await expect(a.service.appendEditorBatch(a.caseId, b.userId, { ...batch, batchId: randomUUID() })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(b.service.appendEditorBatch(b.caseId, b.userId, { ...batch, batchId: randomUUID() })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('closes a move draft atomically and rejects late new telemetry while allowing exact retries', async () => {
    const { caseId, userId, service } = await setup();
    const draftId = randomUUID(), batch = { draftId, batchId: randomUUID(), events: [edit(draftId)] };
    await service.appendEditorBatch(caseId, userId, batch);
    const message = await service.append(caseId, { actor: 'user', type: 'message', content: 'Hello', draftId, clientMsgId: randomUUID() });
    expect((await service.listEditorByDraft(caseId, userId, draftId)).messageEventId).toBe(message.id);
    await expect(service.appendEditorBatch(caseId, userId, { ...batch, batchId: randomUUID(), events: [edit(draftId, { seq: 2 })] }))
      .rejects.toMatchObject({ code: 'VALIDATION' });
    expect((await service.appendEditorBatch(caseId, userId, batch)).acceptedCount).toBe(1);
    const unseenDraft = randomUUID();
    await service.append(caseId, { actor: 'user', type: 'message', content: 'No telemetry', draftId: unseenDraft });
    expect((await service.listEditorByDraft(caseId, userId, unseenDraft)).limitations).toContain('telemetry_unavailable');
  });
  it('rejects conflicting sequences, foreign sources, future sources and oversized batches', async () => {
    const a = await setup(), b = await setup(), draftId = randomUUID();
    const send = (event: EditorEvent) => a.service.appendEditorBatch(a.caseId, a.userId, { draftId, batchId: randomUUID(), events: [event] });
    const original = edit(draftId);
    await send(original);
    await expect(send(edit(draftId, { insertedText: 'changed' }))).rejects.toMatchObject({ code: 'VALIDATION' });
    const foreign = await b.service.append(b.caseId, { actor: 'copilot', type: 'copilot_reply', content: 'source' });
    await expect(send(edit(draftId, { seq: 2, kind: 'copilot_insert', sourceEventId: foreign.id }))).rejects.toMatchObject({ code: 'VALIDATION' });
    const source = await a.service.append(a.caseId, { actor: 'copilot', type: 'copilot_reply', content: 'source' });
    await expect(send(edit(draftId, { seq: 2, sourceEventId: source.id, clientAt: new Date(clock.getTime() - 1000).toISOString() }))).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(a.service.appendEditorBatch(a.caseId, a.userId, { draftId, batchId: randomUUID(),
      events: Array.from({ length: 100 }, (_, i) => edit(draftId, { seq: i + 2, insertedText: 'x'.repeat(16_000) })) }))
      .rejects.toMatchObject({ status: 413 });
  });
  it('preserves gaps as observation limitations without inferring AI use', async () => {
    const { caseId, userId, service } = await setup(), draftId = randomUUID();
    await service.appendEditorBatch(caseId, userId, { draftId, batchId: randomUUID(), events: [edit(draftId, { seq: 3 })] });
    expect((await service.listEditorByDraft(caseId, userId, draftId)).limitations).toContain('sequence_gap');
  });
  it('rejects new telemetry after submit and bounds batches per minute', async () => {
    const { caseId, userId, service } = await setup();
    for (let i = 0; i < 30; i++) {
      const draftId = randomUUID();
      await service.appendEditorBatch(caseId, userId, { draftId, batchId: randomUUID(), events: [edit(draftId)] });
    }
    const draftId = randomUUID();
    await expect(service.appendEditorBatch(caseId, userId, { draftId, batchId: randomUUID(), events: [edit(draftId)] }))
      .rejects.toMatchObject({ code: 'RATE_LIMIT' });
    await fixture.db.query("UPDATE cases SET status='submitted' WHERE id=$1", [caseId]);
    await expect(service.appendEditorBatch(caseId, userId, { draftId, batchId: randomUUID(), events: [edit(draftId)] }))
      .rejects.toMatchObject({ code: 'VALIDATION' });
  });
  it('rejects new telemetry after the server deadline but preserves an accepted batch retry', async () => {
    const { caseId, userId, service } = await setup(), draftId = randomUUID();
    const batch = { draftId, batchId: randomUUID(), events: [edit(draftId)] };
    await service.appendEditorBatch(caseId,userId,batch);
    await fixture.db.query('UPDATE cases SET time_limit_sec=30 WHERE id=$1',[caseId]);
    expect((await service.appendEditorBatch(caseId,userId,batch)).acceptedCount).toBe(1);
    await expect(service.appendEditorBatch(caseId,userId,{ ...batch,batchId: randomUUID() }))
      .rejects.toMatchObject({ code: 'VALIDATION' });
  });
  it.each(['duration','sampling','count'] as const)('rejects unsupported interaction %s bounds', async (kind) => {
    const { caseId, userId, service } = await setup(), draftId = randomUUID();
    const item = window();
    if (kind === 'duration') { item.durationMs = 30_000; item.startedAt = new Date(clock.getTime()-30_000).toISOString(); }
    if (kind === 'sampling') item.pointerMoveSamples = 1000;
    if (kind === 'count') item.clickCount = 1_000_000_000;
    await expect(service.appendEditorBatch(caseId,userId,{ draftId,batchId: randomUUID(),events: [],interactionWindows: [item] }))
      .rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
