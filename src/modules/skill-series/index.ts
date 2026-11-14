import { z } from 'zod';
import {
  CASES_REQUIRED, CaseRef, LEVEL_MIN_ACCURACY, LEVEL_MIN_DIFFICULTY, Level,
  MIN_DISTINCT_ARCHETYPES, SKILL_IDS, WINDOW_DAYS, type SkillId,
} from '@/contracts';
import { skillsForFocus } from '@/contracts/focus';
import type { CatalogService } from '@/modules/catalog';
import type { SqlExecutor } from '@/modules/database';

export const SeriesCase = CaseRef.extend({
  accuracy: z.number().int().min(0).max(100),
  difficulty: Level,
  isDemo: z.boolean(),
  isSeededDemo: z.boolean(),
});
export type SeriesCase = z.infer<typeof SeriesCase>;

const ScoredCase = SeriesCase.omit({ difficulty: true }).extend({ completedAt: z.coerce.date() });

export function assessSeries(cases: readonly SeriesCase[]) {
  const counted = cases.slice(0, CASES_REQUIRED);
  const averageAccuracy = counted.length ? counted.reduce((sum, row) => sum + row.accuracy, 0) / counted.length : null;
  const blockers: string[] = [];
  if (counted.length < CASES_REQUIRED) blockers.push('insufficient_cases');
  else if (new Set(counted.map(({ archetypeId }) => archetypeId)).size < MIN_DISTINCT_ARCHETYPES) blockers.push('insufficient_archetypes');
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
      (c.is_demo AND COALESCE(c.model='synthetic-demo-series',false)) AS "isSeededDemo"
      FROM cases c JOIN evaluations e ON e.case_id=c.id
      WHERE c.user_id=$1 AND c.field='sales' AND c.status='evaluated' AND e.accuracy IS NOT NULL
        AND c.archetype_id IS NOT NULL AND NULLIF(c.brief->>'title','') IS NOT NULL
        AND c.submitted_at >= $2 AND c.submitted_at <= $3
      ORDER BY c.submitted_at DESC,c.id DESC`, [userId, new Date(now.getTime() - WINDOW_DAYS * 86_400_000), now]),
  ]);
  const byArchetype = new Map(pack.archetypes.map((item) => [item.id, item]));
  const bySkill = new Map<SkillId, SeriesCase[]>(SKILL_IDS.map((skill) => [skill, []]));
  for (const row of result.rows) {
    const item = ScoredCase.parse(row);
    const archetype = byArchetype.get(item.archetypeId);
    if (!archetype) continue;
    for (const skill of skillsForFocus(archetype.focus)) {
      const series = bySkill.get(skill)!;
      if (series.length < CASES_REQUIRED) series.push({ ...item, completedAt: item.completedAt.toISOString(), difficulty: archetype.difficulty });
    }
  }
  return [...bySkill].map(([skill, cases]) => ({ skill, ...assessSeries(cases) }));
}
