import { z } from 'zod';
import {
  CASES_REQUIRED, CaseRef, CaseSkillAssessment, CriterionCoverage, LEVEL_MIN_ACCURACY, LEVEL_MIN_DIFFICULTY, Level,
  MIN_CASE_SKILL_SCORE, MIN_DISTINCT_ARCHETYPES, SKILL_IDS, WINDOW_DAYS, type SkillId,
} from '@/contracts';
import { skillsForFocus } from '@/contracts/focus';
import { Percent } from '@/contracts/primitives';
import type { CatalogService } from '@/modules/catalog';
import type { SqlExecutor } from '@/modules/database';

export const SeriesCase = CaseRef.extend({
  accuracy: z.number().int().min(0).max(100),
  difficulty: Level,
  isDemo: z.boolean(),
  isSeededDemo: z.boolean(),
});
export type SeriesCase = z.infer<typeof SeriesCase>;

export const StoredSkillEvidence = z.object({
  skills: z.unknown().optional(),
  criterionCoverage: z.unknown().optional(),
});
const StoredSkillScores = z.array(z.object({ skill: z.string(), score: Percent }));
const StoredCriterionCoverage = z.array(CriterionCoverage);

const ScoredCase = SeriesCase.omit({ difficulty: true }).extend({
  ...StoredSkillEvidence.shape, completedAt: z.coerce.date(),
});

export function readSkillAssessment(skill: SkillId, { skills, criterionCoverage }: z.infer<typeof StoredSkillEvidence>) {
  const scores = StoredSkillScores.safeParse(skills);
  const coverage = StoredCriterionCoverage.safeParse(criterionCoverage);
  const matchingScores = scores.data?.filter((entry) => entry.skill === skill);
  const matchingCoverage = coverage.data?.filter((entry) => entry.criterionId === skill);
  if (matchingScores?.length !== 1 || matchingCoverage?.length !== 1) return undefined;
  return CaseSkillAssessment.safeParse({ score: matchingScores[0].score, status: matchingCoverage[0].status }).data;
}

export function assessSeries(cases: readonly SeriesCase[]) {
  const counted = cases.slice(0, CASES_REQUIRED);
  const averageAccuracy = counted.length ? counted.reduce((sum, row) => sum + row.accuracy, 0) / counted.length : null;
  const blockers: string[] = [];
  if (counted.length < CASES_REQUIRED) blockers.push('insufficient_cases');
  else if (new Set(counted.map(({ archetypeId }) => archetypeId)).size < MIN_DISTINCT_ARCHETYPES) blockers.push('insufficient_archetypes');
  if (counted.some(({ skillAssessment }) => !skillAssessment)) blockers.push('skill_evidence_missing');
  if (counted.some(({ skillAssessment }) => skillAssessment &&
    (skillAssessment.score < MIN_CASE_SKILL_SCORE || skillAssessment.status === 'not_met'))) {
    blockers.push('skill_score_below_threshold');
  }
  if (counted.some(({ outcome }) => outcome === 'left')) blockers.push('left_case');
  if (counted.length === CASES_REQUIRED && averageAccuracy !== null && averageAccuracy < LEVEL_MIN_ACCURACY[1]) {
    blockers.push('accuracy_below_threshold');
  }
  const difficulty = Math.max(...counted.map((row) => Level.options.indexOf(row.difficulty)));
  const levels = [3, 2, 1] as const;
  const level = !blockers.length && averageAccuracy !== null
    ? levels.find((candidate) => averageAccuracy >= LEVEL_MIN_ACCURACY[candidate] &&
      difficulty >= Level.options.indexOf(LEVEL_MIN_DIFFICULTY[candidate])) ?? null
    : null;
  return { counted, averageAccuracy, blockers, level };
}

export async function readSkillSeries(db: SqlExecutor, catalog: CatalogService, userId: string, now: Date) {
  const [pack, result] = await Promise.all([
    catalog.getPack('sales'),
    db.query(`SELECT c.id AS "caseId",c.archetype_id AS "archetypeId",c.brief->>'title' AS title,
      c.submitted_at AS "completedAt",e.accuracy,e.outcome,c.is_demo AS "isDemo",
      e.skills,e.score_audit->'criterionCoverage' AS "criterionCoverage",
      (c.is_demo AND COALESCE(c.model='synthetic-demo-series',false)) AS "isSeededDemo"
      FROM cases c JOIN evaluations e ON e.case_id=c.id
      WHERE c.user_id=$1 AND c.field='sales' AND c.type<>'prep' AND c.status='evaluated' AND e.accuracy IS NOT NULL
        AND c.archetype_id IS NOT NULL AND NULLIF(c.brief->>'title','') IS NOT NULL
        AND c.submitted_at >= $2 AND c.submitted_at <= $3
      ORDER BY c.submitted_at DESC,c.id DESC`, [userId, new Date(now.getTime() - WINDOW_DAYS * 86_400_000), now]),
  ]);
  const byArchetype = new Map(pack.archetypes.map((item) => [item.id, item]));
  const bySkill = new Map<SkillId, SeriesCase[]>(SKILL_IDS.map((skill) => [skill, []]));
  for (const row of result.rows) {
    const { skills, criterionCoverage, ...item } = ScoredCase.parse(row);
    const archetype = byArchetype.get(item.archetypeId);
    if (!archetype) continue;
    for (const skill of skillsForFocus(archetype.focus)) {
      const series = bySkill.get(skill)!;
      if (series.length < CASES_REQUIRED) series.push({
        ...item, completedAt: item.completedAt.toISOString(), difficulty: archetype.difficulty,
        skillAssessment: readSkillAssessment(skill, { skills, criterionCoverage }),
      });
    }
  }
  return [...bySkill].map(([skill, cases]) => ({ skill, ...assessSeries(cases) }));
}
