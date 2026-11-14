import { z } from 'zod';
import { SkillCertificateSlug } from './certificate';
import { AveragePercent, CASES_REQUIRED, CaseRef, SkillCertificateLevel, SkillId, WINDOW_DAYS } from './skill-series';
import { CaseView } from './case';
import { Id, NonEmpty, NonNegativeInt, Percent } from './primitives';

export const SkillProgress = z.object({
  skill: NonEmpty,
  level: NonNegativeInt,
  xp: NonNegativeInt,
  nextLevelXp: NonNegativeInt,
});
export type SkillProgress = z.infer<typeof SkillProgress>;

export const SkillProgressSeries = z.object({
  skill: SkillId,
  casesCounted: z.array(CaseRef).max(CASES_REQUIRED),
  required: z.literal(CASES_REQUIRED),
  windowDays: z.literal(WINDOW_DAYS),
  averageAccuracy: AveragePercent.nullable(),
  eligible: z.boolean(),
  blockers: z.array(z.string()),
  certificate: z.object({ slug: SkillCertificateSlug, level: SkillCertificateLevel }).optional(),
});
export type SkillProgressSeries = z.infer<typeof SkillProgressSeries>;

export const SkillPath = z.object({
  skills: z.array(SkillProgress),
  series: z.array(SkillProgressSeries).default([]),
  streak: z.object({ current: NonNegativeInt, best: NonNegativeInt }),
  today: z.object({ daily: CaseView.nullable(), weekly: CaseView.nullable() }),
  history: z.array(z.object({
    caseId: Id,
    title: NonEmpty,
    accuracy: Percent.nullable(),
    date: z.iso.date(),
  })),
});
export type SkillPath = z.infer<typeof SkillPath>;
