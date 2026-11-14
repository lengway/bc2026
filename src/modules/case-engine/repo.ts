import { z } from 'zod';
import {
  CaseBrief, CaseDoc, CaseType, Field, Level, PersonaOutcome, PersonaPublic, Profile, PublicScoringGuide, WorkspaceType,
} from '@/contracts';
import { PersonaHidden } from '@/contracts/case';
import { Rubric } from '@/contracts/rubric';
import type { SqlExecutor } from '@/modules/database';
import { GeneratedCase } from '@/modules/llm';
import { AppError } from '@/modules/shared';

const DateValue = z.union([z.date(), z.iso.datetime({ offset: true })]).transform((value) => new Date(value).toISOString());
const CaseStatus = z.enum(['generating', 'ready', 'in_progress', 'submitted', 'evaluated', 'failed']);
const StoredPersona = z.object({
  public: PersonaPublic,
  hidden: PersonaHidden,
  state: z.object({
    turn: z.int().nonnegative(), trust: z.int().min(0).max(100), patience: z.int().nonnegative(),
    mood: z.string(), revealed: z.array(z.string()), outcome: PersonaOutcome.nullable(),
  }),
});
const CaseRecord = z.object({
  id: z.uuid(), userId: z.uuid(), field: Field, subfield: z.string(), level: Level,
  archetypeId: z.string().nullable(), type: CaseType, workspace: WorkspaceType, status: CaseStatus,
  brief: CaseBrief.nullable(), docs: z.array(CaseDoc), scoringGuide: PublicScoringGuide.nullable(),
  timeLimitSec: z.int().positive().nullable(), model: z.string().nullable(), promptVersion: z.string().nullable(),
  seed: z.string().nullable(), isDemo: z.boolean(), startedAt: DateValue.nullable(),
  submittedAt: DateValue.nullable(), createdAt: DateValue,
  personas: z.array(StoredPersona), rubric: Rubric.nullable(),
});
export type CaseRecord = z.infer<typeof CaseRecord>;
export type StoredPersona = z.infer<typeof StoredPersona>;

export async function readCase(db: SqlExecutor, caseId: string, userId?: string): Promise<CaseRecord | null> {
  const { rows } = await db.query(`SELECT c.id,c.user_id AS "userId",c.field,c.subfield,c.level,c.archetype_id AS "archetypeId",
    c.type,c.workspace,
    CASE WHEN c.status='generating' AND EXISTS(
      SELECT FROM jobs j WHERE j.case_id=c.id AND j.kind='case.generate' AND j.status='failed'
    ) THEN 'failed' ELSE c.status END AS status,
    c.brief,c.docs,c.scoring_guide AS "scoringGuide",c.time_limit_sec AS "timeLimitSec",
    c.model,c.prompt_version AS "promptVersion",c.seed,c.is_demo AS "isDemo",
    c.started_at AS "startedAt",c.submitted_at AS "submittedAt",c.created_at AS "createdAt",
    coalesce((SELECT jsonb_agg(jsonb_build_object('public',p.public,'hidden',p.hidden,
      'state',jsonb_build_object('turn',s.turn,'trust',s.trust,'patience',s.patience,
      'mood',s.mood,'revealed',s.revealed,'outcome',s.outcome)) ORDER BY p.id)
      FROM personas p JOIN persona_state s ON s.case_id=p.case_id AND s.persona_id=p.id WHERE p.case_id=c.id),'[]'::jsonb) AS personas,
    CASE WHEN r.case_id IS NULL THEN NULL ELSE jsonb_build_object('version',r.version,'criteria',r.criteria,
      'aiUseChecks',r.ai_use_checks,'keyMoments',r.key_moments,'traps',r.traps,'twists',r.twists,
      'successCriteria',r.success_criteria) END AS rubric
    FROM cases c LEFT JOIN rubrics r ON r.case_id=c.id
    WHERE c.id=$1 AND ($2::uuid IS NULL OR c.user_id=$2)`, [caseId, userId ?? null]);
  return rows[0] ? CaseRecord.parse(rows[0]) : null;
}

const ProfileRow = Profile.extend({ updatedAt: DateValue });

export async function lockAndReadProfile(tx: SqlExecutor, userId: string): Promise<Profile> {
  const { rows } = await tx.query(`SELECT p.user_id AS "userId",p.intake_text AS "intakeText",p.field,
    p.subfield,p.level,p.years,p.pains,p.goals,p.updated_at AS "updatedAt"
    FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.id=$1 FOR UPDATE OF u`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 404, 'User account not found.');
  if (rows[0].userId === null) throw new AppError('VALIDATION', 400, 'Complete the intake before creating a case.');
  return ProfileRow.parse(rows[0]);
}

export async function hasUsableDailyCase(tx: SqlExecutor, userId: string, since: Date): Promise<boolean> {
  const { rows } = await tx.query(`SELECT id FROM cases c WHERE user_id=$1 AND type='daily'
    AND created_at>$2 AND (c.started_at IS NOT NULL OR c.submitted_at IS NOT NULL OR (c.status<>'failed' AND NOT EXISTS (
      SELECT FROM jobs j WHERE j.case_id=c.id AND j.kind='case.generate' AND j.status='failed'
    ))) LIMIT 1`, [userId, since]);
  return rows.length > 0;
}

export async function hasActiveSubscription(tx: SqlExecutor, userId: string, now: Date): Promise<boolean> {
  const { rows } = await tx.query("SELECT user_id FROM subscriptions WHERE user_id=$1 AND status='pro' AND current_period_end>$2", [userId, now]);
  return rows.length > 0;
}

export async function createPendingCase(tx: SqlExecutor, profile: Profile, type: CaseType, workspace: WorkspaceType, seed: string, now: Date) {
  const { rows } = await tx.query(`INSERT INTO cases(user_id,field,subfield,level,type,workspace,seed,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
  [profile.userId, profile.field, profile.subfield, profile.level, type, workspace, seed, now]);
  return z.object({ id: z.uuid() }).parse(rows[0]).id;
}

const HistoryRow = z.object({
  archetypeId: z.string().nullable(), title: z.string().nullable(),
  name: z.string().nullable(), company: z.string().nullable(),
});

export async function readHistory(db: SqlExecutor, userId: string, caseId: string) {
  const { rows } = await db.query(`SELECT c.archetype_id AS "archetypeId",c.brief->>'title' AS title,
    p.public->>'name' AS name,p.public->>'company' AS company
    FROM (SELECT id,archetype_id,brief,created_at FROM cases WHERE user_id=$1 AND id<>$2
      AND status IN ('ready','in_progress','submitted','evaluated') ORDER BY created_at DESC,id LIMIT 50) c
    LEFT JOIN personas p ON p.case_id=c.id ORDER BY c.created_at DESC,c.id,p.id`, [userId, caseId]);
  return z.array(HistoryRow).parse(rows);
}
export type HistoryRow = z.infer<typeof HistoryRow>;

const PoolTemplate = z.object({
  id: z.uuid(), workspace: WorkspaceType, seed: z.string(), archetypeId: z.string(), model: z.string(),
  promptVersion: z.string(), generated: GeneratedCase, rubric: Rubric,
});
export type PoolTemplate = z.infer<typeof PoolTemplate>;

const poolColumns = `p.id,p.workspace,p.seed,p.archetype_id AS "archetypeId",p.model,
  p.prompt_version AS "promptVersion",p.generated_case AS generated,p.rubric`;

export async function findUnusedTemplate(tx: SqlExecutor, profile: Profile): Promise<PoolTemplate | null> {
  const { rows } = await tx.query(`SELECT ${poolColumns} FROM onboarding_pool p
    WHERE p.field=$1 AND p.subfield=$2 AND p.level=$3
      AND NOT EXISTS (SELECT FROM cases c WHERE c.user_id=$4 AND (
        c.onboarding_pool_id=p.id OR (c.status IN ('ready','in_progress','submitted','evaluated') AND EXISTS (
          SELECT FROM personas used CROSS JOIN LATERAL jsonb_array_elements(p.generated_case->'personas') candidate(persona)
          WHERE used.case_id=c.id AND (
            lower(used.public->>'name')=lower(candidate.persona->'public'->>'name')
            OR lower(used.public->>'company')=lower(candidate.persona->'public'->>'company')
          )
        ))
      ))`, [profile.field, profile.subfield, profile.level, profile.userId]);
  return rows[0] ? PoolTemplate.parse(rows[0]) : null;
}

export async function findSeededTemplates(db: SqlExecutor, field: Field, subfield: string) {
  const { rows } = await db.query(`SELECT ${poolColumns},p.level FROM onboarding_pool p WHERE p.field=$1 AND p.subfield=$2`, [field, subfield]);
  return z.array(PoolTemplate.extend({ level: Level })).parse(rows);
}

export async function insertTemplate(db: SqlExecutor, profile: { field: Field; subfield: string; level: Level }, template: Omit<PoolTemplate, 'id'>) {
  return (await db.query(`INSERT INTO onboarding_pool(field,subfield,level,archetype_id,workspace,seed,model,prompt_version,generated_case,rubric)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (field,subfield,level) DO NOTHING`,
  [profile.field, profile.subfield, profile.level, template.archetypeId, template.workspace, template.seed,
    template.model, template.promptVersion, JSON.stringify(template.generated), JSON.stringify(template.rubric)])).rowCount === 1;
}

export interface Publication extends Omit<PoolTemplate, 'id'> {
  scoringGuide: PublicScoringGuide;
  isDemo: boolean;
  poolId?: string;
}

export async function publishCase(tx: SqlExecutor, caseId: string, value: Publication, now: Date) {
  const { generated, rubric } = value;
  const updated = await tx.query(`UPDATE cases SET status='ready',brief=$2,docs=$3,scoring_guide=$4,
    time_limit_sec=$5,model=$6,prompt_version=$7,seed=$8,archetype_id=$9,is_demo=$10,onboarding_pool_id=$11,workspace=$12
    WHERE id=$1 AND status='generating'`, [caseId, JSON.stringify(generated.brief), JSON.stringify(generated.docs),
    JSON.stringify(value.scoringGuide), generated.brief.timeLimitSec, value.model, value.promptVersion,
    value.seed, value.archetypeId, value.isDemo, value.poolId ?? null, value.workspace]);
  if (updated.rowCount !== 1) throw new Error('Case is no longer awaiting generation');
  await tx.query(`INSERT INTO rubrics(case_id,version,criteria,ai_use_checks,key_moments,traps,twists,success_criteria)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [caseId, rubric.version, JSON.stringify(rubric.criteria),
    JSON.stringify(rubric.aiUseChecks), JSON.stringify(rubric.keyMoments), JSON.stringify(rubric.traps),
    JSON.stringify(rubric.twists), JSON.stringify(rubric.successCriteria)]);
  for (const persona of generated.personas) {
    await tx.query('INSERT INTO personas(id,case_id,public,hidden) VALUES($1,$2,$3,$4)',
      [persona.public.id, caseId, JSON.stringify(persona.public), JSON.stringify(persona.hidden)]);
    await tx.query('INSERT INTO persona_state(case_id,persona_id,trust,patience,updated_at) VALUES($1,$2,$3,$4,$5)',
      [caseId, persona.public.id, persona.hidden.initialTrust, persona.hidden.patience, now]);
  }
}

export async function readGenerationLease(db: SqlExecutor, jobId: string, caseId: string, owner: string, token: string, now: Date) {
  const { rows } = await db.query(`SELECT status FROM jobs WHERE id=$1 AND case_id=$2 AND kind='case.generate'
    AND (status='completed' OR (status='running' AND locked_by=$3 AND lease_token=$4 AND locked_until>$5))`,
  [jobId, caseId, owner, token, now]);
  return rows[0] ? z.object({ status: z.enum(['running', 'completed']) }).parse(rows[0]).status : null;
}

export async function failCase(tx: SqlExecutor, caseId: string) {
  const result = await tx.query("UPDATE cases SET status='failed' WHERE id=$1 AND status='generating'", [caseId]);
  if (result.rowCount !== 1) throw new Error('Case is no longer awaiting generation');
}

export async function reconcileFailedCases(db: SqlExecutor) {
  const result = await db.query(`UPDATE cases c SET status='failed' WHERE c.status='generating' AND EXISTS (
    SELECT FROM jobs j WHERE j.case_id=c.id AND j.kind='case.generate' AND j.status='failed'
  )`);
  return result.rowCount ?? 0;
}
