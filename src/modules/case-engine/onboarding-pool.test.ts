import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { Level, type Profile } from '@/contracts';
import { createCatalogService } from '@/modules/catalog';
import type { Database, SqlExecutor } from '@/modules/database';
import { createJobsService } from '@/modules/jobs';
import { createLlmService, type LlmProvider } from '@/modules/llm';
import type { PoolTemplate } from './repo';
import { createCaseEngineService } from './service';

vi.mock('@/modules/identity', () => ({ consumeRateLimit: async () => {} }));

const catalog = createCatalogService();

async function setup() {
  const profile: Profile = {
    userId: randomUUID(), field: 'sales', subfield: 'account_executive', level: 'intermediate',
    years: 3, intakeText: 'Wants to practice: Competitor deals.',
    pains: [], goals: [], updatedAt: new Date().toISOString(), dailyGoal: 1,
  };
  type SeedRow = PoolTemplate & Pick<Profile, 'subfield' | 'level' | 'field'>;
  const pool: SeedRow[] = [];
  const seenPoolIds = new Set<string>();
  const chosenArchetypes: string[] = [];
  const now = new Date();
  const db: Database = {
    async query(sql, values = []) {
      if (sql.includes('FROM users u LEFT JOIN profiles p')) return { rows: [profile], rowCount: 1 };
      if (sql.includes('FROM onboarding_pool p')) {
        const rows = pool.filter((row) => row.field === values[0] && row.subfield === values[1] &&
          (values.length === 2 || (row.level === values[2] && !seenPoolIds.has(row.id))));
        return { rows, rowCount: rows.length };
      }
      if (sql.includes('INSERT INTO onboarding_pool')) {
        const [field, subfield, level, archetypeId, workspace, seed, model, promptVersion, generated, rubric] = values;
        const row = { field, subfield, level, archetypeId, workspace, seed, model, promptVersion,
          id: randomUUID(), generated: JSON.parse(String(generated)), rubric: JSON.parse(String(rubric)),
        } as SeedRow;
        pool.push(row);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('UPDATE cases SET status=\'ready\'')) {
        chosenArchetypes.push(String(values[8]));
        seenPoolIds.add(String(values[10]));
      }
      return { rows: [{ id: randomUUID() }], rowCount: 1 };
    },
    async transaction<T>(work: (tx: SqlExecutor) => Promise<T>) { return work(db); },
    async close() {},
  };
  const demo = await catalog.getDemoCase('sales', 'account_executive');
  let generationCount = 0;
  const provider: LlmProvider = {
    async complete({ promptId, model }) {
      if (promptId === 'case.rubric') return { model, text: JSON.stringify(demo.rubric) };
      const n = ++generationCount;
      return { model, text: JSON.stringify({
        brief: demo.case.brief, docs: demo.case.docs,
        personas: demo.personas.map((persona) => ({ ...persona, public: { ...persona.public, name: `Buyer ${n}`, company: `Company ${n}` } })),
      }) };
    },
  };
  const jobs = createJobsService({ db, now: () => now });
  const llm = createLlmService({ provider, defaultModel: 'test-model', recordCall: async () => {} });
  const engine = createCaseEngineService({ catalog, db, jobs, llm, now: () => now });
  function addLegacyTemplate(archetypeId: string) {
    pool.push({
      field: profile.field, subfield: profile.subfield, level: profile.level,
      id: randomUUID(), archetypeId, workspace: demo.case.workspace, seed: randomUUID(),
      model: 'test-model', promptVersion: '1',
      generated: { brief: demo.case.brief, docs: demo.case.docs, personas: demo.personas }, rubric: demo.rubric,
    });
  }
  return { engine, profile, pool, chosenArchetypes, addLegacyTemplate };
}

it('prefers an unused pool archetype matching the stated focus and falls back if exhausted', async () => {
  const { engine, profile, chosenArchetypes, addLegacyTemplate } = await setup();
  addLegacyTemplate('procurement');
  addLegacyTemplate('competitor');

  await engine.generateCase(profile.userId, 'onboarding');
  await engine.generateCase(profile.userId, 'onboarding');

  expect(chosenArchetypes).toEqual(['competitor', 'procurement']);
});

it('adds distinct templates to old role/level groups and leaves a complete pool unchanged', async () => {
  const { engine, pool, addLegacyTemplate } = await setup();
  addLegacyTemplate('procurement');
  const pack = await catalog.getPack('sales');
  const total = pack.subfields.length * Level.options.length * 3;

  expect(await engine.seedOnboardingPool()).toEqual({ inserted: total - 1, existing: 1 });
  for (const subfield of pack.subfields) {
    for (const level of Level.options) {
      const templates = pool.filter((row) => row.subfield === subfield && row.level === level);
      expect(templates).toHaveLength(3);
      expect(new Set(templates.map((row) => row.archetypeId)).size).toBe(3);
      if (subfield === 'account_executive') {
        expect(templates.map((row) => row.archetypeId)).toContain('competitor');
      }
    }
  }
  expect(await engine.seedOnboardingPool()).toEqual({ inserted: 0, existing: total });
});
