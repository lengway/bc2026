import { z } from 'zod';
import { CaseView } from './case';
import { Id, NonEmpty, NonNegativeInt, Percent } from './primitives';

export const SkillProgress = z.object({
  skill: NonEmpty,
  level: NonNegativeInt,
  xp: NonNegativeInt,
  nextLevelXp: NonNegativeInt,
});
export type SkillProgress = z.infer<typeof SkillProgress>;

export const SkillPath = z.object({
  skills: z.array(SkillProgress),
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
