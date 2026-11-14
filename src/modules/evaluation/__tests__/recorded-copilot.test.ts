import { describe, expect, it } from 'vitest';
import { createLlmService, EvaluatedMoves } from '@/modules/llm';
import { SubmittedSnapshot } from '@/modules/simulation';
import { createEvidenceValidator } from '../evidence';
import { prepareSubmission } from '../observations';
import { diagnoseMoveProposals, evaluationOutputSchema } from '../proposals';
import { assessSubmission } from '../scoring';
import recorded from './golden/recorded-copilot-reuse.json';
import strong from './golden/strong.json';
import { modelOutput, snapshotFor } from './support';

// Only move scoring is replayed here. Irrelevant scenario/telemetry fields come from the test harness.
function recordedCase() {
  const { snapshot } = snapshotFor(strong);
  snapshot.case.rubric.criteria = recorded.criteria;
  snapshot.case.rubric.aiUseChecks = [];
  snapshot.events = recorded.events.map((event) => ({
    ...event,
    actor: event.actor as SubmittedSnapshot['events'][number]['actor'],
    type: event.type as SubmittedSnapshot['events'][number]['type'],
    caseId: snapshot.case.id,
    personaId: event.type === 'message' ? snapshot.case.personas[0].public.id : null,
    meta: { availableDocumentIds: [] },
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, event.seq)).toISOString(),
    clientMsgId: null, draftId: null, isPublic: true,
  }));
  const prepared = prepareSubmission(SubmittedSnapshot.parse(snapshot));
  const output = EvaluatedMoves.parse({ ...modelOutput, moves: recorded.recordedMoves });
  return { prepared, output };
}

describe('recorded Copilot-reuse scoring failure', () => {
  it('reproduces the null score because the model itself withheld all five assessments', () => {
    const { prepared, output } = recordedCase();
    expect(output.moves).toHaveLength(5);
    expect(output.moves.every((move) => move.assessmentStatus === 'insufficient_evidence')).toBe(true);
    expect(output.moves.slice(1).every((move) => move.rubricRef && move.evidence.length > 0)).toBe(true);
    const validator = createEvidenceValidator(prepared);
    for (const proposal of output.moves) {
      const move = prepared.messages.find((event) => event.id === proposal.eventId)!;
      expect(proposal.evidence.every((item) => validator.validates(item, move))).toBe(true);
    }
    expect(diagnoseMoveProposals(prepared, output.moves)).toEqual([]);
    const review = assessSubmission(prepared, output, { model: 'recorded-v2-response', promptVersion: '2' });
    expect(review.evaluation).toMatchObject({ accuracy: null, scoreAudit: { scoredMoveCount: 0, totalUserMoveCount: 5 } });
  });

  it('accepts the recorded evidence for four substantive actions when manually reclassified', () => {
    const { prepared, output } = recordedCase();
    // This is a manual counterfactual, not a new provider response or a production-score update.
    const corrected = structuredClone(output);
    const reasons = [
      'The question identifies the finance requirement, approval owner and submission steps.',
      'The learner makes net-60 conditional on approval and preserves the subscription terms.',
      'The learner requests the written requirement and proposes fee verification, but leaves reconciliation incomplete.',
      'The learner sets a specific status checkpoint without guaranteeing approval.',
    ];
    corrected.moves.slice(1).forEach((move, index) => {
      move.assessmentStatus = 'assessed';
      move.why = reasons[index];
    });
    expect(evaluationOutputSchema(prepared).safeParse(corrected).success).toBe(true);
    expect(corrected.moves.map((move) => move.evidence)).toEqual(output.moves.map((move) => move.evidence));
    const review = assessSubmission(prepared, corrected, { model: 'manual-counterfactual', promptVersion: '3' });
    expect(review.evaluation).toMatchObject({ accuracy: 80, scoreAudit: { scoredMoveCount: 4, totalUserMoveCount: 5 } });
    expect(review.moves[0]).toMatchObject({ userText: 'Hello!', points: null, assessmentStatus: 'insufficient_evidence' });
    expect(review.evaluation.aiDependency).toBeGreaterThan(0);
  });

  it('explicitly permits copied Copilot advice without an originality condition in v3', async () => {
    const { prepared, output } = recordedCase();
    let instructions = '';
    const llm = createLlmService({ defaultModel: 'mock-scorer', recordCall: async () => {}, provider: {
      async complete(request) { instructions = request.instructions; return { text: JSON.stringify(output), model: request.model }; },
    } });
    await llm.run('eval.moves', {}, evaluationOutputSchema(prepared));
    expect(instructions).toContain('Copying or closely following permitted Copilot advice is an assessable action');
    expect(instructions).toContain('Do not require original wording, independent authorship, or additions beyond the advice');
    expect(instructions).toContain('Assistance and AI dependency are reported separately');
  });
});
