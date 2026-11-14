import 'dotenv/config';
import { createDatabase } from '../src/modules/database';
import { createCatalogService } from '../src/modules/catalog';
import { createCredentialsService } from '../src/modules/credentials';
import { createGuestDemoSeeder, getOrCreateDemoSeriesAccount } from '../src/modules/demo';
import { createProgressService } from '../src/modules/progress';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Run database migrations before seeding.');
const db = createDatabase(process.env.DATABASE_URL);
try {
  const catalog = createCatalogService();
  // Seeding uses only transaction-local writes. Display and billing reads belong to the app.
  const loadSubmission = async () => null;
  const progress = createProgressService({ db, catalog, loadSubmission, getCaseForUser: async () => null });
  const credentials = createCredentialsService({
    db, catalog, loadSubmission, canFull: async () => false,
    getReview: async () => { throw new Error('Read the demo review in the application.'); },
  });
  const seed = createGuestDemoSeeder({ catalog, progress, credentials });
  const userId = await db.transaction(async (tx) => {
    const userId = await getOrCreateDemoSeriesAccount(tx);
    await seed(tx, userId, new Date());
    return userId;
  });
  const { series } = await progress.getSkillPath(userId);
  const closing = series.find(({ skill }) => skill === 'closing')?.certificate;
  if (!closing) throw new Error('The demo Closing certificate is missing.');
  console.info(`Demo Closing certificate: /s/${closing.slug}`);
} finally {
  await db.close();
}
