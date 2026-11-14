import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parse } from 'dotenv';
import { Pool } from 'pg';
import { createDatabase, migrate, type Database } from '@/modules/database';

export async function createTestDatabase(): Promise<{ db: Database; url: string; cleanup(): Promise<void> }> {
  const local: Record<string, string> = await readFile('.env.test.local', 'utf8').then(parse).catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    throw error;
  });
  const connectionString = process.env.TEST_DATABASE_URL?.trim() || local.TEST_DATABASE_URL;
  if (!connectionString) throw new Error('TEST_DATABASE_URL is required; PostgreSQL tests are never skipped');
  const name = `bc_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString, max: 1 });
  let db: Database | undefined;
  let created = false;
  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    await db?.close();
    // Only this helper-generated identifier can reach DROP; never the supplied database.
    if (!/^bc_test_[a-f0-9]{32}$/.test(name)) throw new Error('Unsafe test database identifier');
    if (created) await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.end();
    cleaned = true;
  };
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    const target = new URL(connectionString);
    target.pathname = `/${name}`;
    db = createDatabase(target.toString());
    await migrate(db);
    return { db, url: target.toString(), cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
