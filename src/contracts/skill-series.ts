import { z } from 'zod';
import { EvaluationOutcome } from './evaluation';
import { Id, NonEmpty, Percent, Timestamp } from './primitives';

export const CASES_REQUIRED = 3;
export const WINDOW_DAYS = 30;
export const MIN_DISTINCT_ARCHETYPES = 2;
export const MIN_CASE_SKILL_SCORE = 70;
export const LEVEL_MIN_ACCURACY = { 1: 70, 2: 80, 3: 88 } as const;
export const LEVEL_MIN_DIFFICULTY = { 1: 'beginner', 2: 'intermediate', 3: 'advanced' } as const;

export const SKILL_IDS = ['discovery', 'objection_handling', 'value_articulation', 'critical_ai_use', 'closing'] as const;
export const SkillId = z.enum(SKILL_IDS);
export type SkillId = z.infer<typeof SkillId>;

export const SkillCertificateLevel = z.literal([1, 2, 3]);
export type SkillCertificateLevel = z.infer<typeof SkillCertificateLevel>;

export const AveragePercent = z.number().min(0).max(100);

export const CaseSkillAssessment = z.object({
  score: Percent,
  status: z.enum(['met', 'partially_met', 'not_met']),
});
export type CaseSkillAssessment = z.infer<typeof CaseSkillAssessment>;

export const CaseRef = z.object({
  caseId: Id,
  title: NonEmpty,
  archetypeId: NonEmpty,
  accuracy: Percent.nullable(),
  outcome: EvaluationOutcome,
  completedAt: Timestamp,
  skillAssessment: CaseSkillAssessment.optional(),
});
export type CaseRef = z.infer<typeof CaseRef>;
