import { z } from 'zod';
import { Id, NonEmpty, NonNegativeInt, Percent, PositiveInt } from './primitives';
import { AiUseSkill, AssistanceProfile, MoveLabel, MOVE_LABEL_POINTS, ScoreAudit, ScoreEvidence, TrapResult } from './scoring';
import { ProcessObservations } from './telemetry';

export { MoveLabel } from './scoring';

export const AssessmentStatus = z.enum(['assessed', 'insufficient_evidence']);
export type AssessmentStatus = z.infer<typeof AssessmentStatus>;

export const MoveReview = z.object({
  eventId: Id,
  seq: PositiveInt,
  userText: NonEmpty,
  label: MoveLabel,
  why: NonEmpty,
  betterMove: NonEmpty.nullable(),
  innerThought: z.string(),
  trustAfter: Percent,
  rubricRef: NonEmpty.nullable(),
  points: Percent.nullable(),
  evidence: z.array(ScoreEvidence),
  assessmentStatus: AssessmentStatus,
}).refine(({ assessmentStatus, evidence, label, points, rubricRef }) => (
  assessmentStatus === 'assessed'
    ? points === MOVE_LABEL_POINTS[label] && rubricRef !== null && evidence.length > 0
    : points === null
), { path: ['points'], message: 'Assessed moves require criterion evidence and the points for their label' });
export type MoveReview = z.infer<typeof MoveReview>;

export const EvaluationOutcome = z.enum(['won', 'lost', 'left', 'incomplete']);
export type EvaluationOutcome = z.infer<typeof EvaluationOutcome>;

// Preserve the design layer's outcome import while sharing the canonical schema.
export const CaseOutcome = EvaluationOutcome;
export type CaseOutcome = EvaluationOutcome;

export const PublicEvaluation = z.object({
  caseId: Id,
  accuracy: Percent.nullable(),
  labelCounts: z.record(MoveLabel, NonNegativeInt),
  aiDependency: Percent.nullable(),
  trapCaught: z.boolean(),
  assistance: AssistanceProfile,
  aiUseSkill: AiUseSkill,
  trapResult: TrapResult,
  scoreAudit: ScoreAudit,
  outcome: EvaluationOutcome,
  topMoves: z.array(MoveReview).max(3),
  summary: NonEmpty,
  skills: z.array(z.object({ skill: NonEmpty, score: Percent })),
  trustCurve: z.array(z.object({ seq: PositiveInt, trust: Percent })),
}).refine(({ trapCaught, trapResult }) => trapCaught === (trapResult === 'caught'), {
  path: ['trapCaught'],
  message: 'The legacy trap flag must agree with trapResult',
}).refine(({ aiDependency, assistance }) => aiDependency === assistance.copilotTextSimilarityPercent, {
  path: ['aiDependency'],
  message: 'The legacy assistance percentage represents copilot text similarity',
}).refine(({ accuracy, scoreAudit }) => accuracy === (scoreAudit.maxPoints === 0
  ? null
  : Math.round(100 * scoreAudit.pointsSum / scoreAudit.maxPoints)), {
  path: ['accuracy'],
  message: 'Accuracy must come from scored move points and be null if there are no scored moves',
}).refine(({ topMoves }) => topMoves.every((move) => move.assessmentStatus === 'assessed'), {
  path: ['topMoves'],
  message: 'Only assessed moves can appear among the top moves',
});
export type PublicEvaluation = z.infer<typeof PublicEvaluation>;

export const Evaluation = PublicEvaluation.safeExtend({
  processObservations: ProcessObservations,
});
export type Evaluation = z.infer<typeof Evaluation>;
