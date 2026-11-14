import { randomUUID } from 'node:crypto';
import {
  CaseParams, CaseResponse, CASES_REQUIRED, CaseType, Field, GenerateCaseResponse, Level, MOVE_LABEL_POINTS, Profile, PublicScoringGuide, SalesCallPrep, SkillId,
} from '@/contracts';
import { Rubric } from '@/contracts/rubric';
import type { Archetype, CatalogService } from '@/modules/catalog';
import { currentCertificates } from '@/modules/credentials';
import type { Database, SqlExecutor } from '@/modules/database';
import { readSkillSeries } from '@/modules/skill-series';
import { consumeRateLimit } from '@/modules/identity';
import type { Job, JobsService } from '@/modules/jobs';
import { GeneratedCase, type LlmService } from '@/modules/llm';
import { AppError, systemClock, type Clock } from '@/modules/shared';
import {
  createPendingCase, failCase, findSeededTemplates, findUnusedTemplate, hasActiveSubscription, hasUsableFreeCase, clearFinishedPrepInputs,
  insertTemplate, lockAndReadProfile, publishCase, readCase, readGenerationLease, readHistory, readRecoverablePrep, readUsedArchetypes, reconcileFailedCases,
  type CaseRecord, type HistoryRow, type PoolTemplate, type Publication,
} from './repo';
import { pressureScenario } from './pressure-case';

const timeLimits = { onboarding: 480, daily: 600, weekly: 2_400, prep: 600 } satisfies Record<CaseType, number>;
const weeklyWindowMs = 7 * 86_400_000;
const accuracyFormula = 'round(100 × pointsSum / maxPoints), with maxPoints = 100 × scoredMoveCount. No scored moves means no accuracy score.';
const aiUseFormula = 'round(100 × earnedPoints / assessedMaxPoints). No assessed checks means no AI-use score.';
const publicCriteria: Record<string, { title: string; description: string }> = {
  discovery: { title: 'Discovery', description: 'Identify the customer’s operational problem and how it is measured.' },
  objection_handling: { title: 'Objection handling', description: 'Address the customer’s concerns while respecting documented constraints.' },
  value_articulation: { title: 'Value articulation', description: 'Connect the proposal to the customer’s priorities and available evidence.' },
  critical_ai_use: { title: 'Critical use of AI', description: 'Verify material claims in copilot advice before relying on them.' },
  closing: { title: 'Closing', description: 'Agree on a practical next step with an owner, timing and a clear agenda.' },
};

export interface CaseEngineDeps {
  db: Database;
  jobs: JobsService;
  llm: LlmService;
  catalog: CatalogService;
  now?: Clock;
  demoMode?: boolean;
  canStart?: (userId: string, type: CaseType, tx: SqlExecutor) => Promise<boolean>;
}

interface GenerationLease { jobId: string; owner: string; token: string }
type ScenarioProfile = Pick<Profile, 'field' | 'subfield' | 'level' | 'intakeText' | 'years' | 'pains' | 'goals'>;
type Scenario = Omit<PoolTemplate, 'id' | 'workspace'>;

function historyValues(history: HistoryRow[], key: keyof HistoryRow): string[] {
  const values = history.map((row) => row[key]).filter((value): value is string => value !== null);
  return [...new Set(values)];
}

export function scoringGuide(rubric: Rubric): PublicScoringGuide {
  return PublicScoringGuide.parse({
    version: rubric.version,
    criteria: rubric.criteria.map(({ id }) => ({
      id,
      ...(Object.hasOwn(publicCriteria, id) ? publicCriteria[id] : {
        title: 'Case-specific criterion',
        description: 'Apply the documented case requirements to the decision.',
      }),
    })),
    labelPoints: MOVE_LABEL_POINTS,
    accuracyFormula,
    aiUseFormula,
    requiredCheckCount: rubric.criteria.filter((criterion) => criterion.required).length,
    allowedTools: ['Workspace copilot', 'Case documents', 'Personal notes'],
    observationNotice: 'While this workspace is active, editor changes and interaction aggregates may be recorded. The review describes observations and their limitations.',
  });
}

function uniqueIds(generated: GeneratedCase) {
  const ids = [...generated.personas.map((persona) => persona.public.id), ...generated.docs.map((doc) => doc.id)];
  return new Set(ids).size === ids.length;
}

function materialize(template: Scenario & { workspace: Publication['workspace'] }, type: CaseType, isDemo: boolean, poolId?: string): Publication {
  const { generated, rubric } = template;
  if (!uniqueIds(generated)) throw new Error('Scenario IDs must be unique');
  const ids = new Map(generated.personas.map((persona) => [persona.public.id, randomUUID()]));
  const idFor = (id: string) => ids.get(id) ?? id;
  const privateRubric: Rubric = {
    ...rubric,
    aiUseChecks: rubric.aiUseChecks.map((check) => ({ ...check, sourceRefs: check.sourceRefs.map(idFor) })),
    twists: rubric.twists.map((twist) => ({
      ...twist, event: { ...twist.event, from: idFor(twist.event.from) },
    })),
  };
  return {
    ...template, isDemo, poolId, scoringGuide: scoringGuide(privateRubric), rubric: privateRubric,
    generated: {
      brief: { ...generated.brief, timeLimitSec: timeLimits[type] },
      personas: generated.personas.map((persona) => ({ ...persona, public: { ...persona.public, id: idFor(persona.public.id) } })),
      docs: generated.docs,
    },
  };
}

export function availableDocuments({ docs, personas }: Pick<CaseRecord, 'docs' | 'personas'>) {
  const turn = personas.reduce((latest, persona) => Math.max(latest, persona.state.turn), 0);
  return docs.filter((doc) => doc.arrivesAtTurn === null || doc.arrivesAtTurn <= turn);
}

export function createCaseEngineService({ db, jobs, llm, catalog, now = systemClock, demoMode = false, canStart }: CaseEngineDeps) {
  async function entitled(userId: string, type: CaseType, tx: SqlExecutor, instant: Date) {
    if (canStart) return canStart(userId, type, tx);
    if (type === 'onboarding' || await hasActiveSubscription(tx, userId, instant)) return true;
    return (type === 'daily' || type === 'prep') && !await hasUsableFreeCase(tx, userId, new Date(instant.getTime() - weeklyWindowMs));
  }

  async function generateCase(userId: string, type: CaseType, { skill, prep }: { skill?: SkillId; prep?: SalesCallPrep } = {}): Promise<GenerateCaseResponse> {
    const request = CaseType.safeParse(type);
    if (!request.success) throw new AppError('VALIDATION', 400, 'Invalid case type.');
    if (skill !== undefined && (request.data !== 'daily' || !SkillId.safeParse(skill).success)) {
      throw new AppError('VALIDATION', 400, 'A skill can only be selected for a daily case.');
    }
    const details = prep === undefined ? undefined : SalesCallPrep.safeParse(prep);
    if ((type === 'prep') !== (details !== undefined) || details?.success === false) {
      throw new AppError('VALIDATION', 400, 'Provide all three sales call details for preparation cases only.');
    }
    return db.transaction(async (tx) => {
      const profile = await lockAndReadProfile(tx, userId);
      const instant = now();
      if (profile.field !== 'sales') throw new AppError('VALIDATION', 400, 'Practice cases are currently available in Sales.');
      if (!await entitled(userId, request.data, tx, instant)) throw new AppError('PAYWALL', 403, 'This case requires an available plan entitlement.');
      await consumeRateLimit(tx, `case:generate:${userId}`, 10, 3_600_000, instant);
      const generationProfile = details?.success
        ? { ...profile, intakeText: '', years: null, pains: [], goals: [] }
        : profile;
      const pool = request.data === 'onboarding' ? await findUnusedTemplate(tx, profile) : null;
      const caseId = await createPendingCase(tx, profile, request.data, 'chat', pool?.seed ?? randomUUID(), instant);
      if (pool) {
        await publishCase(tx, caseId, materialize(pool, request.data, false, pool.id), instant);
      } else {
        await jobs.enqueueWithExecutor(tx, {
          caseId, kind: 'case.generate', dedupeKey: `case.generate:${caseId}`, payload: { profile: generationProfile, ...(skill && { skill }), ...(details?.success && { prep: details.data }) },
        });
      }
      return { caseId, status: 'generating' };
    });
  }

  async function getCaseRecord(caseId: string, { userId, executor = db }: { userId?: string; executor?: SqlExecutor } = {}) {
    if (!CaseParams.safeParse({ id: caseId }).success) return null;
    return readCase(executor, caseId, userId);
  }

  async function getCaseForUser(caseId: string, userId: string): Promise<CaseResponse> {
    const record = await getCaseRecord(caseId, { userId });
    if (!record) throw new AppError('NOT_FOUND', 404, 'Case not found.');
    if (record.status === 'generating' || record.status === 'failed') {
      return { id: record.id, status: record.status, ...(record.type === 'prep' && { type: record.type }) };
    }
    return CaseResponse.parse({
      id: record.id,
      type: record.type,
      workspace: record.workspace,
      status: record.status === 'submitted' ? 'evaluating' : record.status,
      startedAt: record.startedAt,
      field: record.field,
      subfield: record.subfield,
      brief: record.brief,
      personas: record.personas.map((persona) => persona.public),
      docs: availableDocuments(record),
      scoringGuide: record.scoringGuide,
    });
  }

  async function getRecoverablePrep(userId: string) {
    return readRecoverablePrep(db, userId, new Date(now().getTime() - weeklyWindowMs));
  }

  async function generatePressureCase(userId: string): Promise<GenerateCaseResponse> {
    return db.transaction(async (tx) => {
      const profile = await lockAndReadProfile(tx, userId);
      const instant = now();
      if (profile.field !== 'sales') throw new AppError('VALIDATION', 400, 'Pressure cases are currently available in Sales.');
      if (!await entitled(userId, 'onboarding', tx, instant)) throw new AppError('PAYWALL', 403, 'This case requires an available plan entitlement.');
      await consumeRateLimit(tx, `case:generate:${userId}`, 10, 3_600_000, instant);
      const caseId = await createPendingCase(tx, profile, 'onboarding', 'chat', pressureScenario.seed, instant);
      await publishCase(tx, caseId, materialize({ ...pressureScenario, workspace: 'chat' }, 'onboarding', false), instant);
      return { caseId, status: 'generating' };
    });
  }

  async function generateScenario(
    profile: ScenarioProfile, type: CaseType, seed: string, archetype: Archetype, history: HistoryRow[], caseId?: string, prep?: SalesCallPrep,
  ): Promise<Scenario> {
    const avoid = {
      names: historyValues(history, 'name'),
      companies: historyValues(history, 'company'),
      archetypes: historyValues(history, 'archetypeId'),
      titles: historyValues(history, 'title'),
    };
    const normalized = (value: string) => value.trim().toLowerCase();
    const avoidNames = new Set(avoid.names.map(normalized));
    const avoidCompanies = new Set(avoid.companies.map(normalized));
    const Generation = GeneratedCase.refine((value) => uniqueIds(value) &&
      value.personas.length <= (type === 'weekly' ? 2 : 1) &&
      value.personas.every((persona) => !avoidNames.has(normalized(persona.public.name)) && !avoidCompanies.has(normalized(persona.public.company))),
    'Use unique document and persona IDs, the persona count for this case type, and fresh persona names and companies');
    const scenarioProfile: ScenarioProfile = {
      field: profile.field, subfield: profile.subfield, level: profile.level, intakeText: profile.intakeText,
      years: profile.years, pains: profile.pains, goals: profile.goals,
    };
    const options = { caseId, omitContentFromLogs: prep !== undefined };
    const result = await llm.run('case.generate', {
      profile: scenarioProfile, archetype, seed, avoid, type, timeLimitSec: timeLimits[type], ...(prep && { prep }),
    }, Generation, options);
    const generated = { ...result.data, brief: { ...result.data.brief, timeLimitSec: timeLimits[type] } };
    const documentIds = new Set(generated.docs.map((doc) => doc.id));
    const sourceIds = new Set([...documentIds, ...generated.personas.map((persona) => persona.public.id)]);
    const identifiers = new Set(Object.keys(publicCriteria));
    const rubricSchema = Rubric.refine((rubric) => (
      (type !== 'onboarding' || rubric.twists.length <= 1) &&
      rubric.criteria.every((criterion) => identifiers.has(criterion.id)) &&
      rubric.aiUseChecks.every((check) => check.sourceRefs.every((id) => sourceIds.has(id))) &&
      rubric.twists.every((twist) => twist.documentIds.every((id) => documentIds.has(id)))
    ), 'Use Sales dimension IDs and existing source IDs. Twist documentIds must refer to case documents. Onboarding allows at most one twist.');
    const rubric = (await llm.run('case.rubric', { case: generated, archetype, type, dimensions: [...identifiers] }, rubricSchema, options)).data;
    return { generated, rubric, archetypeId: archetype.id, model: result.meta.model, promptVersion: result.meta.promptVersion, seed };
  }

  async function handleGenerateJob(job: Job, lease: GenerationLease) {
    if (job.kind !== 'case.generate' || job.id !== lease.jobId) throw new Error('Invalid case generation job');
    const status = await readGenerationLease(db, lease.jobId, job.caseId, lease.owner, lease.token, now());
    if (status === 'completed') return;
    if (status !== 'running') throw new Error('Case generation lease lost');
    const record = await getCaseRecord(job.caseId);
    if (!record?.seed || record.status !== 'generating') throw new Error('Case is not awaiting generation');
    const profile = Profile.parse(job.payload.profile);
    if (profile.userId !== record.userId || profile.field !== record.field || profile.subfield !== record.subfield || profile.level !== record.level) {
      throw new Error('Case generation profile does not match its queued case');
    }
    const prep = record.type === 'prep' ? SalesCallPrep.parse(job.payload.prep) : undefined;
    const history = await readHistory(db, record.userId, record.id);
    const requested = job.payload.skill === undefined ? undefined : SkillId.parse(job.payload.skill);
    let target: { skill: SkillId; seriesArchetypeIds: string[] } | undefined;
    if (record.type === 'daily' && profile.field === 'sales') {
      const series = await readSkillSeries(db, catalog, record.userId, now());
      const certificates = requested ? [] : await currentCertificates(db, record.userId);
      const priority = (counted: number) => counted === CASES_REQUIRED ? 0 : counted;
      const selected = requested
        ? series.find(({ skill }) => skill === requested)
        : series.filter(({ counted, level, skill }) => counted.length > 0 && level === null &&
            !certificates.some((item) => item.skill === skill))
          .sort((a, b) => priority(b.counted.length) - priority(a.counted.length) ||
            b.counted[0].completedAt.localeCompare(a.counted[0].completedAt))[0];
      if (selected) target = { skill: selected.skill, seriesArchetypeIds: selected.counted.map(({ archetypeId }) => archetypeId) };
    }
    const usedArchetypes = target
      ? await readUsedArchetypes(db, record.userId, record.id)
      : historyValues(history, 'archetypeId');
    const archetype = await catalog.pickArchetype(profile, usedArchetypes, target);
    let publication: Publication | undefined;
    try {
      const scenario = await generateScenario(profile, record.type, record.seed, archetype, history, record.id, prep);
      publication = materialize({ ...scenario, workspace: record.workspace }, record.type, false);
    } catch {
      if (record.type === 'onboarding' || (demoMode && !requested && record.type !== 'prep')) {
        const demo = await catalog.getDemoCase(record.field, record.subfield);
        publication = materialize({
          workspace: demo.case.workspace, model: 'demo', promptVersion: demo.rubric.version, seed: record.seed,
          archetypeId: `demo:${record.subfield}`, generated: { brief: demo.case.brief, docs: demo.case.docs, personas: demo.personas },
          rubric: demo.rubric,
        }, record.type, true);
      }
    }
    await db.transaction(async (tx) => {
      if (!await jobs.completeWithExecutor(tx, lease.jobId, lease.owner, lease.token)) throw new Error('Case generation lease lost');
      if (prep) await clearFinishedPrepInputs(tx, record.id);
      if (publication) await publishCase(tx, record.id, publication, now());
      else await failCase(tx, record.id);
    });
  }

  async function seedOnboardingPool(field: Field = 'sales') {
    const pack = await catalog.getPack(field);
    let inserted = 0;
    let existing = 0;
    for (const subfield of pack.subfields) {
      const seeded = await findSeededTemplates(db, field, subfield);
      const levels = new Set(seeded.map((template) => template.level));
      const history: HistoryRow[] = seeded.flatMap((template) => template.generated.personas.map(({ public: persona }) => ({
        name: persona.name, company: persona.company, title: template.generated.brief.title, archetypeId: template.archetypeId,
      })));
      for (const level of Level.options) {
        if (levels.has(level)) {
          existing += 1;
          continue;
        }
        const profile = { field, subfield, level, intakeText: '', years: null, pains: [], goals: [] };
        const archetype = await catalog.pickArchetype(profile, historyValues(history, 'archetypeId'));
        const template = await generateScenario(profile, 'onboarding', randomUUID(), archetype, history);
        const saved = await insertTemplate(db, profile, { ...template, workspace: pack.workspace });
        if (saved) inserted += 1;
        else existing += 1;
        history.push(...template.generated.personas.map(({ public: persona }) => ({
          name: persona.name, company: persona.company, title: template.generated.brief.title, archetypeId: template.archetypeId,
        })));
      }
    }
    return { inserted, existing };
  }

  return {
    generateCase, generatePressureCase, getCaseForUser, getCaseRecord, getRecoverablePrep, handleGenerateJob, seedOnboardingPool,
    reconcileFailedGenerations: () => reconcileFailedCases(db),
  };
}

export type CaseEngineService = ReturnType<typeof createCaseEngineService>;
