import { z } from 'zod';
import { Level, NonEmpty, NonNegativeInt, Percent, PositiveInt } from './primitives';
import { InputMode, ObservationStatus } from './telemetry';

export const MoveLabel = z.enum(['brilliant', 'best', 'good', 'inaccuracy', 'mistake', 'blunder']);
export type MoveLabel = z.infer<typeof MoveLabel>;

export const MOVE_LABEL_POINTS = {
  brilliant: 100,
  best: 100,
  good: 80,
  inaccuracy: 50,
  mistake: 20,
  blunder: 0,
} as const satisfies Record<MoveLabel, number>;

export const LabelPoints = z.object({
  brilliant: z.literal(MOVE_LABEL_POINTS.brilliant),
  best: z.literal(MOVE_LABEL_POINTS.best),
  good: z.literal(MOVE_LABEL_POINTS.good),
  inaccuracy: z.literal(MOVE_LABEL_POINTS.inaccuracy),
  mistake: z.literal(MOVE_LABEL_POINTS.mistake),
  blunder: z.literal(MOVE_LABEL_POINTS.blunder),
});
export type LabelPoints = z.infer<typeof LabelPoints>;

export const ScoringCriterion = z.object({
  id: NonEmpty,
  title: NonEmpty,
  description: NonEmpty,
});
export type ScoringCriterion = z.infer<typeof ScoringCriterion>;

export const PublicScoringGuide = z.object({
  version: NonEmpty,
  criteria: z.array(ScoringCriterion).min(1),
  labelPoints: LabelPoints,
  accuracyFormula: NonEmpty,
  aiUseFormula: NonEmpty,
  requiredCheckCount: NonNegativeInt,
  allowedTools: z.array(NonEmpty),
  observationNotice: NonEmpty,
}).refine(({ requiredCheckCount, criteria }) => requiredCheckCount <= criteria.length, {
  path: ['requiredCheckCount'],
  message: 'Required check count cannot exceed the number of criteria',
});
export type PublicScoringGuide = z.infer<typeof PublicScoringGuide>;

export const ScoreEvidence = z.object({
  source: z.enum(['user_event', 'persona_event', 'case_doc', 'copilot_event', 'editor_aggregate']),
  sourceId: NonEmpty,
  quote: NonEmpty,
  explanation: NonEmpty,
});
export type ScoreEvidence = z.infer<typeof ScoreEvidence>;

export const TrapResult = z.enum(['caught', 'missed', 'not_presented', 'insufficient_evidence']);
export type TrapResult = z.infer<typeof TrapResult>;

export const AssistanceProfile = z.object({
  copilotRequests: NonNegativeInt,
  knownCopilotRetainedChars: NonNegativeInt,
  totalSubmittedChars: NonNegativeInt,
  copilotRetainedPercent: Percent.nullable(),
  copilotTextSimilarityPercent: Percent.nullable(),
  unknownPasteCount: NonNegativeInt,
  unknownPasteChars: NonNegativeInt,
  observedInputModes: z.array(InputMode),
  observationStatus: ObservationStatus,
  limitations: z.array(NonEmpty),
}).refine((profile) => profile.knownCopilotRetainedChars <= profile.totalSubmittedChars, {
  path: ['knownCopilotRetainedChars'],
  message: 'Retained copilot characters cannot exceed submitted characters',
}).refine((profile) => profile.totalSubmittedChars !== 0 || (
  profile.copilotRetainedPercent === null && profile.copilotTextSimilarityPercent === null
), { message: 'Percentages are unavailable without a submitted message' });
export type AssistanceProfile = z.infer<typeof AssistanceProfile>;

export const AiUseCheckStatus = z.enum(['passed', 'failed', 'not_observed', 'not_applicable']);
export type AiUseCheckStatus = z.infer<typeof AiUseCheckStatus>;

export const AiUseCheck = z.object({
  id: NonEmpty,
  criterionId: NonEmpty,
  status: AiUseCheckStatus,
  earnedPoints: NonNegativeInt,
  maxPoints: PositiveInt,
  evidence: z.array(ScoreEvidence),
  reason: NonEmpty,
}).refine(({ earnedPoints, maxPoints, status, evidence }) => {
  if (status === 'passed' || status === 'failed') return earnedPoints <= maxPoints && evidence.length > 0;
  return earnedPoints === 0;
}, { message: 'Only assessed checks with evidence can award points up to their maximum' });
export type AiUseCheck = z.infer<typeof AiUseCheck>;

export const AiUseSkillSummary = z.object({
  score: Percent.nullable(),
  assessedChecks: NonNegativeInt,
  applicableChecks: NonNegativeInt,
  earnedPoints: NonNegativeInt,
  assessedMaxPoints: NonNegativeInt,
  applicableMaxPoints: NonNegativeInt,
}).refine((summary) => (
  summary.assessedChecks <= summary.applicableChecks &&
  summary.earnedPoints <= summary.assessedMaxPoints &&
  summary.assessedMaxPoints <= summary.applicableMaxPoints &&
  (summary.assessedChecks === 0) === (summary.assessedMaxPoints === 0) &&
  (summary.applicableChecks === 0) === (summary.applicableMaxPoints === 0) &&
  summary.score === (summary.assessedMaxPoints === 0
    ? null
    : Math.round(100 * summary.earnedPoints / summary.assessedMaxPoints))
), { message: 'AI-use score and points must agree with assessment coverage' });
export type AiUseSkillSummary = z.infer<typeof AiUseSkillSummary>;

export const AiUseSkill = AiUseSkillSummary.safeExtend({
  checks: z.array(AiUseCheck),
}).refine(({ checks, ...summary }) => {
  const applicable = checks.filter((check) => check.status !== 'not_applicable');
  const assessed = applicable.filter((check) => check.status === 'passed' || check.status === 'failed');
  return new Set(checks.map((check) => check.id)).size === checks.length &&
    summary.applicableChecks === applicable.length &&
    summary.assessedChecks === assessed.length &&
    summary.earnedPoints === assessed.reduce((sum, check) => sum + check.earnedPoints, 0) &&
    summary.assessedMaxPoints === assessed.reduce((sum, check) => sum + check.maxPoints, 0) &&
    summary.applicableMaxPoints === applicable.reduce((sum, check) => sum + check.maxPoints, 0);
}, { path: ['checks'], message: 'AI-use aggregates must match the recorded checks' });
export type AiUseSkill = z.infer<typeof AiUseSkill>;

export const CriterionCoverage = z.object({
  criterionId: NonEmpty,
  status: z.enum(['met', 'partially_met', 'not_met', 'not_observed', 'not_applicable']),
});
export type CriterionCoverage = z.infer<typeof CriterionCoverage>;

export const ScoreCompletionStatus = z.enum(['complete', 'partial', 'insufficient_evidence']);
export type ScoreCompletionStatus = z.infer<typeof ScoreCompletionStatus>;

export const ScoringSummary = z.object({
  rubricVersion: NonEmpty,
  scorerModel: NonEmpty,
  scorerPromptVersion: NonEmpty,
  caseLevel: Level,
  scoredMoveCount: NonNegativeInt,
  totalUserMoveCount: NonNegativeInt,
  pointsSum: NonNegativeInt,
  maxPoints: NonNegativeInt,
  formula: NonEmpty,
  completionStatus: ScoreCompletionStatus,
  limitations: z.array(NonEmpty),
}).refine((score) => (
  score.scoredMoveCount <= score.totalUserMoveCount &&
  score.maxPoints === 100 * score.scoredMoveCount &&
  score.pointsSum <= score.maxPoints
), { message: 'Score totals must agree with the count of scored moves' });
export type ScoringSummary = z.infer<typeof ScoringSummary>;

export const ScoreAudit = ScoringSummary.safeExtend({
  labelPoints: LabelPoints,
  criterionCoverage: z.array(CriterionCoverage),
});
export type ScoreAudit = z.infer<typeof ScoreAudit>;
