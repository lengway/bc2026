import { z } from "zod";
import { Count, Level, MoveLabel, Percent } from "./common";
import { InputMode } from "./telemetry";
const LabelPoints = z.record(MoveLabel, Percent);
export const PublicScoringGuide = z.object({
  version: z.string(),
  criteria: z.array(
    z.object({ id: z.string(), title: z.string(), description: z.string() }),
  ),
  labelPoints: LabelPoints,
  accuracyFormula: z.string(),
  aiUseFormula: z.string(),
  requiredCheckCount: Count,
  allowedTools: z.array(z.string()),
  observationNotice: z.string(),
});
export const ScoreEvidence = z.object({
  source: z.enum([
    "user_event",
    "persona_event",
    "case_doc",
    "copilot_event",
    "editor_aggregate",
  ]),
  sourceId: z.string(),
  quote: z.string(),
  explanation: z.string(),
});
export const TrapResult = z.enum([
  "caught",
  "missed",
  "not_presented",
  "insufficient_evidence",
]);
export const ObservationStatus = z.enum([
  "available",
  "partial",
  "unavailable",
]);
export const AssistanceProfile = z.object({
  copilotRequests: Count,
  knownCopilotRetainedChars: Count,
  totalSubmittedChars: Count,
  copilotRetainedPercent: Percent.nullable(),
  copilotTextSimilarityPercent: Percent.nullable(),
  unknownPasteCount: Count,
  unknownPasteChars: Count,
  observedInputModes: z.array(InputMode),
  observationStatus: ObservationStatus,
  limitations: z.array(z.string()),
});
export const AiUseCheck = z.object({
  id: z.string(),
  criterionId: z.string(),
  status: z.enum(["passed", "failed", "not_observed", "not_applicable"]),
  earnedPoints: z.number().nonnegative(),
  maxPoints: z.number().positive(),
  evidence: z.array(ScoreEvidence),
  reason: z.string(),
});
export const AiUseSkillSummary = z.object({
  score: Percent.nullable(),
  assessedChecks: Count,
  applicableChecks: Count,
  earnedPoints: z.number().nonnegative(),
  assessedMaxPoints: z.number().nonnegative(),
  applicableMaxPoints: z.number().nonnegative(),
});
export const AiUseSkill = AiUseSkillSummary.extend({
  checks: z.array(AiUseCheck),
});
export const ScoringSummary = z.object({
  rubricVersion: z.string(),
  scorerModel: z.string(),
  scorerPromptVersion: z.string(),
  caseLevel: Level,
  scoredMoveCount: Count,
  totalUserMoveCount: Count,
  pointsSum: z.number().nonnegative(),
  maxPoints: z.number().nonnegative(),
  formula: z.string(),
  completionStatus: z.enum(["complete", "partial", "insufficient_evidence"]),
  limitations: z.array(z.string()),
});
export const ScoreAudit = ScoringSummary.extend({
  labelPoints: LabelPoints,
  criterionCoverage: z.array(
    z.object({
      criterionId: z.string(),
      status: z.enum([
        "met",
        "partially_met",
        "not_met",
        "not_observed",
        "not_applicable",
      ]),
    }),
  ),
});
export const ProcessObservations = z.object({
  rulesVersion: z.string(),
  observationStatus: ObservationStatus,
  automationStatus: z.enum([
    "signals_observed",
    "no_signals_observed",
    "insufficient_data",
  ]),
  signals: z.array(
    z.object({
      code: z.string(),
      observedValue: z.json(),
      windowId: z.string().optional(),
      messageId: z.string().optional(),
      explanation: z.string(),
      limitation: z.string(),
    }),
  ),
  textFeatures: z.array(
    z.object({
      messageId: z.string(),
      charCount: Count,
      punctuationCounts: z.record(z.string(), Count),
      listMarkerCount: Count,
      editCount: Count.nullable(),
      languageIssues: z
        .object({ count: Count, method: z.string(), version: z.string() })
        .nullable(),
    }),
  ),
  limitations: z.array(z.string()),
});

export type PublicScoringGuide = z.infer<typeof PublicScoringGuide>;

export type ScoreEvidence = z.infer<typeof ScoreEvidence>;

export type TrapResult = z.infer<typeof TrapResult>;

export type ObservationStatus = z.infer<typeof ObservationStatus>;

export type AssistanceProfile = z.infer<typeof AssistanceProfile>;

export type AiUseCheck = z.infer<typeof AiUseCheck>;

export type AiUseSkillSummary = z.infer<typeof AiUseSkillSummary>;

export type AiUseSkill = z.infer<typeof AiUseSkill>;

export type ScoringSummary = z.infer<typeof ScoringSummary>;

export type ScoreAudit = z.infer<typeof ScoreAudit>;

export type ProcessObservations = z.infer<typeof ProcessObservations>;
