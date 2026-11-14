import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { z } from 'zod';

export interface SqlResult { rows: Record<string, unknown>[]; rowCount: number | null }
export interface SqlExecutor { query(sql: string, values?: readonly unknown[]): Promise<SqlResult> }
export interface Database extends SqlExecutor {
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export function createDatabase(connectionString: string): Database {
  const pool = new Pool({ connectionString, max: 10 });
  const connections = new Set<Promise<void>>();
  pool.on('connect', (client) => {
    const ended = new Promise<void>((resolve) => { client.once('end', resolve); });
    connections.add(ended);
    void ended.then(() => { connections.delete(ended); });
  });
  let closing: Promise<void> | undefined;
  return {
    async query(sql, values) { return pool.query<Record<string, unknown>>(sql, values ? [...values] : undefined); },
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work({ async query(sql, values) {
          return client.query<Record<string, unknown>>(sql, values ? [...values] : undefined);
        } });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
    close() {
      closing ??= (async () => {
        // pg-pool removes clients before socket shutdown completes; await both boundaries.
        await pool.end();
        await Promise.all(connections);
      })();
      return closing;
    },
  };
}

/** Explicit, atomic and checksum-protected. Concurrent runners serialize on a transaction lock. */
export async function migrate(db: Database, directory = path.resolve('db/migrations')): Promise<void> {
  const files = (await readdir(/*turbopackIgnore: true*/ directory)).filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
  await db.transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock($1)', [80141234]);
    await tx.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const rows = z.array(z.object({ name: z.string(), checksum: z.string() })).parse(
      (await tx.query('SELECT name, checksum FROM schema_migrations')).rows,
    );
    const applied = new Map(rows.map((row) => [row.name, row.checksum]));
    for (const name of files) {
      const sql = await readFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ directory, name), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      if (applied.has(name)) {
        if (applied.get(name) !== checksum) throw new Error(`Applied migration checksum changed: ${name}`);
        continue;
      }
      await tx.query(sql);
      await tx.query('INSERT INTO schema_migrations(name, checksum) VALUES ($1, $2)', [name, checksum]);
    }
  });
}

