import { z } from "zod";
import { CaseView } from "./case";

export const SkillPath = z.object({
  skills: z.array(
    z.object({
      skill: z.string(),
      level: z.number().int(),
      xp: z.number().int(),
      nextLevelXp: z.number().int(),
    }),
  ),
  streak: z.object({ current: z.number().int(), best: z.number().int() }),
  today: z.object({
    daily: CaseView.nullable(),
    weekly: CaseView.nullable(),
  }),
  history: z.array(
    z.object({
      caseId: z.string(),
      title: z.string(),
      accuracy: z.number().int(),
      date: z.string(),
    }),
  ),
});
export type SkillPath = z.infer<typeof SkillPath>;
