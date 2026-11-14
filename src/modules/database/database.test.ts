import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../../tests/backend/db-helper';
import { migrate } from './index';

describe('PostgreSQL schema and transactions', () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => { fixture = await createTestDatabase(); });
  afterAll(async () => { await fixture?.cleanup(); });

  it('applies migrations once and creates private infrastructure tables', async () => {
    const before = await fixture.db.query('SELECT name,checksum FROM schema_migrations ORDER BY name');
    await migrate(fixture.db);
    const result = await fixture.db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    expect(result.rows.map((row) => row.table_name)).toEqual(expect.arrayContaining([
      'users', 'auth_tokens', 'sessions', 'profiles', 'subscriptions', 'cases', 'personas', 'persona_state',
      'rubrics', 'events', 'editor_drafts', 'editor_events', 'editor_batches', 'interaction_windows',
      'move_reviews', 'evaluations', 'certificates', 'skill_progress', 'progress_awards', 'streaks',
      'llm_calls', 'jobs', 'rate_limits', 'billing_webhook_events',
    ]));
    expect((await fixture.db.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows).toEqual(before.rows);
    expect(before.rows.map(row=>row.name)).toContain('001_initial.sql');
  });

  it('rolls back all writes when a transaction fails', async () => {
    await expect(fixture.db.transaction(async (tx) => {
      await tx.query('INSERT INTO users(email) VALUES ($1)', ['rollback@example.test']);
      throw new Error('abort');
    })).rejects.toThrow('abort');
    expect((await fixture.db.query('SELECT id FROM users WHERE email = $1', ['rollback@example.test'])).rowCount).toBe(0);
  });

  it('distinguishes guest identities explicitly, with regular users as the default', async () => {
    const regular = await fixture.db.query('INSERT INTO users(email) VALUES ($1) RETURNING is_guest',['regular@example.test']);
    const guest = await fixture.db.query('INSERT INTO users(email,is_guest) VALUES ($1,true) RETURNING is_guest',['guest@example.test']);
    expect(regular.rows[0].is_guest).toBe(false);
    expect(guest.rows[0].is_guest).toBe(true);
  });

  it('rejects edits to an already applied migration', async () => {
    const directory = await mkdtemp(path.join(tmpdir(),'bc-migrations-'));
    try {
      await writeFile(path.join(directory,'001_initial.sql'),'SELECT 1;');
      await expect(migrate(fixture.db,directory)).rejects.toThrow('checksum changed');
    } finally { await unlink(path.join(directory,'001_initial.sql')); await rmdir(directory); }
  });

  it('rolls back a failed migration and does not mark it applied', async () => {
    const directory = await mkdtemp(path.join(tmpdir(),'bc-migrations-'));
    try {
      await writeFile(path.join(directory,'002_failed.sql'),'CREATE TABLE rollback_probe(id integer); SELECT missing_column FROM rollback_probe;');
      await expect(migrate(fixture.db,directory)).rejects.toThrow('missing_column');
      expect((await fixture.db.query("SELECT to_regclass('public.rollback_probe') AS table_name")).rows[0].table_name).toBeNull();
      expect((await fixture.db.query("SELECT count(*)::int AS count FROM schema_migrations WHERE name='002_failed.sql'")).rows[0].count).toBe(0);
    } finally { await unlink(path.join(directory,'002_failed.sql')); await rmdir(directory); }
  });
});
