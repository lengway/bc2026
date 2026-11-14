import 'dotenv/config';
import { createCaseEngineService } from '../src/modules/case-engine';
import { createCatalogService } from '../src/modules/catalog';
import { createDatabase } from '../src/modules/database';
import { createJobsService } from '../src/modules/jobs';
import { createLlmService, OpenAIProvider } from '../src/modules/llm';
import { createLlmCallRecorder } from '../src/modules/runtime';

const { DATABASE_URL, OPENAI_API_KEY, LLM_MODEL, LLM_TIMEOUT_MS } = process.env;
if (!DATABASE_URL || !OPENAI_API_KEY || !LLM_MODEL) throw new Error('DATABASE_URL, OPENAI_API_KEY and LLM_MODEL are required.');
const db = createDatabase(DATABASE_URL);
try {
  const catalog = createCatalogService();
  const llm = createLlmService({
    provider: new OpenAIProvider({ apiKey: OPENAI_API_KEY }), defaultModel: LLM_MODEL,
    // Same timeout as the app: generation takes 45–60 s, the library default is 30 s.
    defaultTimeoutMs: Number(LLM_TIMEOUT_MS) || 90_000,
    recordCall: createLlmCallRecorder(db),
  });
  const engine = createCaseEngineService({ db, catalog, llm, jobs: createJobsService({ db }) });
  const { inserted, existing } = await engine.seedOnboardingPool();
  console.info(`Onboarding templates: ${inserted} inserted, ${existing} already present.`);
} finally {
  await db.close();
}
