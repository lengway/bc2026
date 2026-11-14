import 'dotenv/config';
import { createDatabase, migrate } from '../src/modules/database';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const db = createDatabase(process.env.DATABASE_URL);
try { await migrate(db); console.info('Database migrations applied.'); }
finally { await db.close(); }
