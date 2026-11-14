import { EvaluatedMoves } from '@/modules/llm';
import { createEvidenceValidator, type EvidenceValidator } from './evidence';
import type { PreparedSubmission, SnapshotEvent } from './observations';

type MoveProposal = EvaluatedMoves['moves'][number];
export interface MoveProposalIssue { path: (string | number)[]; message: string }

// These checks are shared with final scoring so a repaired proposal cannot bypass evidence validation.
export function moveAssessmentIssues(
  proposal: MoveProposal, move: SnapshotEvent, criteria: ReadonlySet<string>, evidence: EvidenceValidator,
): MoveProposalIssue[] {
  const issues: MoveProposalIssue[] = [];
  if (!proposal.rubricRef || !criteria.has(proposal.rubricRef)) issues.push({
    path: ['rubricRef'], message: 'Assessed moves must reference an exact rubric.criteria[].id.',
  });
  if (!proposal.evidence.some((item) => item.source === 'user_event' && item.sourceId === move.id)) issues.push({
    path: ['evidence'], message: 'Assessed moves require a user_event quote whose sourceId equals this move eventId.',
  });
  for (const [index, item] of proposal.evidence.entries()) {
    const reason = evidence.rejection(item, move);
    if (reason) issues.push({ path: ['evidence', index], message: reason });
  }
  return issues;
}

// Exposed separately for replaying a recorded llm_calls response without a provider call.
export function diagnoseMoveProposals(prepared: PreparedSubmission, proposals: MoveProposal[]): MoveProposalIssue[] {
  const messages = new Map(prepared.messages.map((move) => [move.id, move]));
  const criteria = new Set(prepared.snapshot.case.rubric.criteria.map((criterion) => criterion.id));
  const evidence = createEvidenceValidator(prepared);
  const counts = new Map<string, number>();
  const issues: MoveProposalIssue[] = [];
  for (const [index, proposal] of proposals.entries()) {
    counts.set(proposal.eventId, (counts.get(proposal.eventId) ?? 0) + 1);
    const move = messages.get(proposal.eventId);
    if (!move) {
      issues.push({ path: ['moves', index, 'eventId'], message: 'eventId must identify a learner message to a persona in this case.' });
      continue;
    }
    if (proposal.assessmentStatus === 'assessed') issues.push(...moveAssessmentIssues(proposal, move, criteria, evidence)
      .map((issue) => ({ ...issue, path: ['moves', index, ...issue.path] })));
    if (counts.get(proposal.eventId)! > 1) issues.push({
      path: ['moves', index, 'eventId'], message: `Duplicate assessment for eventId ${proposal.eventId}; return it exactly once.`,
    });
  }
  for (const id of messages.keys()) {
    if (!counts.has(id)) issues.push({ path: ['moves'], message: `Missing assessment for eventId ${id}; include every learner message exactly once.` });
  }
  return issues;
}

export function evaluationOutputSchema(prepared: PreparedSubmission) {
  return EvaluatedMoves.superRefine((output, context) => {
    for (const issue of diagnoseMoveProposals(prepared, output.moves)) context.addIssue({ code: 'custom', ...issue });
  });
}
