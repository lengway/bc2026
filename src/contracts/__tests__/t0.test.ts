import { describe, expect, it } from 'vitest';
import * as fixture from '../../mocks/fixtures';
import * as publicContracts from '..';
import {
  CaseResponse, CaseView, CertificateFull, CertificateLimited, CertificateResponse,
  EditorBatch, EditorBatchAck, Evaluation, Event, EventsPage, EventsQuery, InteractionWindow,
  MoveRequest, MoveReview, PublicEvaluation, ReviewResponse, SessionView, SkillPath,
} from '..';

describe('shared fixtures', () => {
  it('provides a playable case and all five rendered document kinds', () => {
    const view = CaseView.parse(fixture.caseView);
    expect(view.personas[0]).toMatchObject({ name: 'Dana Whitfield', company: 'Brightline Logistics', location: 'Columbus, OH' });
    expect(new Set(view.docs.map((doc) => doc.kind)).size).toBe(5);
    expect(view.startedAt).toBeNull();
  });

  it('links each scored move and evidence quote to the available transcript or document', () => {
    const events = EventsPage.parse(fixture.eventsPage).events;
    const docs = CaseView.parse(fixture.caseView).docs;
    const moves = MoveReview.array().parse(fixture.moves);
    expect(events.length).toBeGreaterThanOrEqual(12);
    expect(moves.length).toBeGreaterThanOrEqual(6);
    for (const move of moves) {
      expect(events.find((event) => event.id === move.eventId)).toMatchObject({ actor: 'user', type: 'message', seq: move.seq, content: move.userText });
      for (const evidence of move.evidence) {
        if (evidence.source === 'case_doc') {
          expect(JSON.stringify(docs.find((doc) => doc.id === evidence.sourceId)?.content)).toContain(evidence.quote);
          continue;
        }
        const sourceEvent = events.find((event) => event.id === evidence.sourceId);
        expect(sourceEvent?.content).toContain(evidence.quote);
        expect(sourceEvent?.seq).toBeLessThanOrEqual(move.seq);
      }
    }
  });

  it('records the independently checkable score and a sourced correction of a wrong copilot claim', () => {
    const { evaluation, moves } = ReviewResponse.parse(fixture.review);
    expect(evaluation).toMatchObject({
      accuracy: 75, trapCaught: true, trapResult: 'caught',
      scoreAudit: { pointsSum: 450, maxPoints: 600, scoredMoveCount: 6, totalUserMoveCount: 6 },
      aiUseSkill: { score: 100, assessedChecks: 2, applicableChecks: 3, earnedPoints: 5, assessedMaxPoints: 5, applicableMaxPoints: 6 },
    });
    expect(moves.map((move) => move.points)).toEqual([80, 50, 100, 20, 100, 100]);
    expect(moves[2].evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'copilot_event', quote: 'Quarterly billing is available on the pilot' }),
      expect.objectContaining({ source: 'case_doc', quote: 'Monthly billing only during the pilot' }),
    ]));
    expect(evaluation.assistance).toMatchObject({
      totalSubmittedChars: 689, copilotTextSimilarityPercent: 11, unknownPasteCount: 1,
      unknownPasteChars: 103, observationStatus: 'partial', copilotRetainedPercent: null,
    });
  });

  it('distinguishes missing evidence from zero observed similarity', () => {
    const { evaluation, moves } = ReviewResponse.parse(fixture.insufficientReview);
    const { events } = EventsPage.parse(fixture.insufficientEventsPage);
    expect(evaluation).toMatchObject({
      accuracy: null, aiDependency: 0, trapResult: 'not_presented', trapCaught: false,
      assistance: { totalSubmittedChars: 9, copilotRetainedPercent: null, copilotTextSimilarityPercent: 0 },
      aiUseSkill: { score: null, assessedChecks: 0 }, scoreAudit: { completionStatus: 'insufficient_evidence', maxPoints: 0 },
    });
    expect(moves[0]).toMatchObject({ assessmentStatus: 'insufficient_evidence', points: null });
    expect(events[0]).toMatchObject({ caseId: evaluation.caseId, id: moves[0].eventId, content: moves[0].userText });
  });

  it('projects both certificate depths and preserves the limited structure', () => {
    const limited = CertificateLimited.parse(fixture.certificateLimited);
    const full = CertificateFull.parse(fixture.certificateFull);
    expect(CertificateResponse.parse(fixture.certificateLimited)).toEqual(limited);
    expect(CertificateResponse.parse(fixture.certificateFull)).toEqual(full);
    expect(CertificateLimited.parse(full)).toEqual(limited);
    expect(full.evaluation.accuracy).toBe(limited.accuracy);
    expect(limited.verificationScope).toBe('recorded_simulation');
    expect(SkillPath.parse(fixture.skillPath).history[0].accuracy).toBe(limited.accuracy);
  });

  it('records keyboard-only, touch and a synthetic workspace edit without changing the skills result', () => {
    const [keyboardOnly, touch] = fixture.editorBatches.map((batch) => EditorBatch.parse(batch));
    const [keyboardAck, touchAck] = fixture.editorAcks.map((ack) => EditorBatchAck.parse(ack));
    expect(keyboardOnly.interactionWindows?.[0]).toMatchObject({ pointerTypes: [], pathLengthNormalized: null, webdriverReported: null });
    expect(keyboardAck).toEqual({ acceptedCount: 0, lastDraftSeq: 0, acceptedWindowCount: 1 });
    expect(touch.events).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'paste', sourceEventId: null })]));
    expect(touchAck).toEqual({ acceptedCount: 2, lastDraftSeq: 2, acceptedWindowCount: 1 });
    expect(touch.interactionWindows?.[0]).toMatchObject({ pointerTypes: ['touch'], untrustedEventCount: 1 });
    const { evaluation } = ReviewResponse.parse(fixture.review);
    expect(evaluation.accuracy).toBe(75);
    expect(evaluation.processObservations).toMatchObject({
      automationStatus: 'insufficient_data',
      textFeatures: expect.arrayContaining([expect.objectContaining({
        punctuationCounts: expect.objectContaining({ emDash: 1 }),
        languageIssues: null,
      })]),
    });
  });
});

describe('wire boundaries', () => {
  it('strips private case, persona, scoring and event properties recursively', () => {
    const { caseView } = fixture;
    const publicCase = CaseView.parse({
      ...caseView,
      rubric: { version: 'private' },
      personas: caseView.personas.map((persona) => ({ ...persona, hidden: { realMotive: 'private' } })),
      scoringGuide: { ...caseView.scoringGuide, traps: ['private'] },
    });
    expect(publicCase).toEqual(caseView);
    const event = fixture.eventsPage.events[1];
    expect(Event.parse({ ...event, meta: { ...event.meta, innerThought: 'private', trapId: 'private' } })).toEqual(event);
    expect(CaseResponse.parse({ ...caseView, status: 'generating' })).toEqual({ id: caseView.id, status: 'generating' });
    expect(CaseResponse.safeParse({ ...caseView, status: 'submitted' }).success).toBe(false);
    expect(publicContracts).not.toHaveProperty('Rubric');
    expect(publicContracts).not.toHaveProperty('PersonaHidden');
  });

  it('keeps owner process observations out of every certificate projection', () => {
    const owner = Evaluation.parse(fixture.review.evaluation);
    expect(owner).toHaveProperty('processObservations');
    expect(PublicEvaluation.parse(owner)).not.toHaveProperty('processObservations');
    expect(CertificateFull.parse({ ...fixture.certificateFull, evaluation: owner }).evaluation).not.toHaveProperty('processObservations');
  });

  it('projects an anonymous or authenticated session without token fields', () => {
    const user = { id: fixture.caseView.id, email: 'jordan@relaygrid.example', displayName: 'Jordan Reyes' };
    const expiresAt = '2026-03-13T15:00:00.000Z';
    expect(SessionView.parse(null)).toBeNull();
    expect(SessionView.parse({ user: { ...user, tokenHash: 'private' }, expiresAt, cookieToken: 'private' })).toEqual({ user: { ...user, isGuest: false }, expiresAt });
  });

  it('rejects invalid enums, ranges and malformed SSE cursors', () => {
    const move = fixture.moves[0];
    expect(MoveReview.safeParse({ ...move, label: 'suspect' }).success).toBe(false);
    expect(MoveReview.safeParse({ ...move, trustAfter: 101 }).success).toBe(false);
    expect(Evaluation.safeParse({ ...fixture.review.evaluation, accuracy: -1 }).success).toBe(false);
    expect(EventsQuery.parse({ afterSeq: '12' })).toEqual({ afterSeq: 12 });
    expect(EventsQuery.parse({})).toEqual({ afterSeq: 0 });
    for (const afterSeq of ['-1', '1e3', '1.5', 'garbage']) {
      expect(EventsQuery.safeParse({ afterSeq }).success).toBe(false);
    }
    expect(EventsPage.safeParse({ ...fixture.eventsPage, lastSeq: 0 }).success).toBe(false);
  });

  it('refuses unsupported points and derived scores that contradict the evidence coverage', () => {
    const review = fixture.review.evaluation;
    expect(MoveReview.safeParse({ ...fixture.moves[0], points: 100 }).success).toBe(false);
    expect(MoveReview.safeParse({ ...fixture.moves[0], evidence: [] }).success).toBe(false);
    expect(Evaluation.safeParse({ ...review, accuracy: 80 }).success).toBe(false);
    expect(Evaluation.safeParse({ ...review, trapCaught: false }).success).toBe(false);
    expect(Evaluation.safeParse({ ...review, aiUseSkill: { ...review.aiUseSkill, applicableChecks: 2 } }).success).toBe(false);
  });

  it('accepts legacy moves without a draft and accepts a batch containing only interaction windows', () => {
    const request = { clientMsgId: fixture.eventsPage.events[0].id, personaId: 'dana', text: 'What is the target for April?' };
    expect(MoveRequest.parse(request).draftId).toBeNull();
    const batch = fixture.editorBatches[0];
    expect(EditorBatch.parse(batch).events).toEqual([]);
    expect(EditorBatch.safeParse({ ...batch, interactionWindows: [] }).success).toBe(false);
  });

  it('rejects raw coordinates, invalid timestamps, and edits for a different draft', () => {
    const batch = fixture.editorBatches[1];
    const window = batch.interactionWindows[0];
    expect(InteractionWindow.safeParse({ ...window, coordinates: [{ x: 1, y: 2 }] }).success).toBe(false);
    expect(InteractionWindow.safeParse({ ...window, endedAt: '2020-01-01T00:00:00.000Z' }).success).toBe(false);
    expect(EditorBatch.safeParse({ ...batch, events: [{ ...batch.events[0], draftId: batch.batchId }] }).success).toBe(false);
    expect(EditorBatch.safeParse({ ...batch, events: [{ ...batch.events[0], rangeStart: 2, rangeEnd: 1 }] }).success).toBe(false);
  });
});
