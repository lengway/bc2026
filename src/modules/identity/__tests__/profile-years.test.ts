import { expect, it } from 'vitest';
import { IntakeRequest } from '@/contracts';
import { createCatalogService } from '@/modules/catalog';
import type { Database, SqlExecutor } from '@/modules/database';
import { createLlmService, MockProvider } from '@/modules/llm';
import { createProfileService } from '../profile';

it.each([3, 0, undefined])('persists structured experience %s ahead of the model estimate', async (years) => {
  const db: Database = {
    async query(_sql, values = []) {
      const [user_id, intake_text, field, subfield, level, years, pains, goals, updated_at, daily_goal] = values;
      return { rows: [{ user_id, intake_text, field, subfield, level, years, pains, goals, updated_at, daily_goal: daily_goal ?? 1 }], rowCount: 1 };
    },
    async transaction<T>(work: (tx: SqlExecutor) => Promise<T>) {
      return work({ query: async () => ({ rows: [{ count: 1 }], rowCount: 1 }) });
    },
    async close() {},
  };
  const estimatedYears = 5;
  const llm = createLlmService({
    defaultModel: 'test-model',
    provider: new MockProvider({ 'intake.parse': [JSON.stringify({
      subfield: 'account_executive', years: estimatedYears, pains: [], goals: [],
    })] }),
    recordCall: async () => {},
  });
  const service = createProfileService({ db, llm, catalog: createCatalogService() });

  const profile = await service.upsertProfileFromIntake('253d92c2-660d-467a-a51b-0f1a7b52b0cc', {
    field: 'sales', level: 'intermediate', text: 'Experience: 3–5 years.', ...(years !== undefined && { years }),
  });

  expect(profile.years).toBe(years ?? estimatedYears);
});

it('rejects a supplied experience value that cannot fit the stored column', () => {
  expect(IntakeRequest.safeParse({ field: 'sales', level: 'intermediate', text: '', years: 2 ** 31 }).success).toBe(false);
});
