import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { Database, SqlExecutor } from '@/modules/database';
import { AppError } from '@/modules/shared';

const JobKindSchema = z.enum(['case.generate','case.evaluate']);
export type JobKind = z.infer<typeof JobKindSchema>;
const DateValue = z.union([z.date(),z.iso.datetime({ offset: true })]).transform((date) => new Date(date).toISOString());
const Row = z.object({
  id: z.uuid(), kind: JobKindSchema, case_id: z.uuid(), dedupe_key: z.string(), payload: z.record(z.string(),z.json()),
  status: z.enum(['pending','running','completed','failed']), attempts: z.int().nonnegative(), max_attempts: z.int().positive(),
  available_at: DateValue, locked_until: DateValue.nullable(), locked_by: z.string().nullable(), lease_token: z.uuid().nullable(),
  last_error: z.string().nullable(), created_at: DateValue, updated_at: DateValue,
});
function parseJob(row: Record<string, unknown>) {
  const value = Row.parse(row);
  return { id: value.id, kind: value.kind, caseId: value.case_id, dedupeKey: value.dedupe_key, payload: value.payload,
    status: value.status, attempts: value.attempts, maxAttempts: value.max_attempts, availableAt: value.available_at,
    lockedUntil: value.locked_until, lockedBy: value.locked_by, leaseToken: value.lease_token, lastError: value.last_error,
    createdAt: value.created_at, updatedAt: value.updated_at };
}
export type Job = ReturnType<typeof parseJob>;
const Enqueue = z.object({
  kind: JobKindSchema, caseId: z.uuid(), dedupeKey: z.string().min(1).max(256), payload: z.record(z.string(),z.json()).default({}),
  maxAttempts: z.int().min(1).max(10).default(3), availableAt: z.date().optional(),
});
export type EnqueueJob = z.input<typeof Enqueue>;
const Claim = z.object({ leaseMs: z.int().min(1000).max(900_000).default(60_000), caseId: z.uuid().optional(), kind: JobKindSchema.optional() });
export type ClaimOptions = z.input<typeof Claim>;
function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError('VALIDATION',400,'Invalid job input');
  return parsed.data;
}

export function createJobsService({ db, now = () => new Date() }: { db: Database; now?: () => Date }) {
  async function enqueueWithExecutor(tx: SqlExecutor, input: EnqueueJob): Promise<Job> {
    const value = validate(Enqueue,input);
    const instant = now();
    const inserted = await tx.query(`INSERT INTO jobs(kind,case_id,dedupe_key,payload,max_attempts,available_at,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT(dedupe_key) DO NOTHING RETURNING *`,
    [value.kind,value.caseId,value.dedupeKey,JSON.stringify(value.payload),value.maxAttempts,value.availableAt ?? instant,instant]);
    if (inserted.rows[0]) return parseJob(inserted.rows[0]);
    const prior = parseJob((await tx.query('SELECT * FROM jobs WHERE dedupe_key=$1',[value.dedupeKey])).rows[0]);
    if (prior.kind !== value.kind || prior.caseId !== value.caseId || prior.maxAttempts !== value.maxAttempts || !isDeepStrictEqual(prior.payload,value.payload))
      throw new AppError('VALIDATION',409,'Job deduplication key was already used');
    return prior;
  }
  async function claim(owner: string, options: ClaimOptions = {}): Promise<Job | null> {
    validate(z.string().min(1).max(128),owner);
    const opts = validate(Claim,options), instant = now();
    return db.transaction(async (tx) => {
      // A crashed worker on its last attempt must become terminal, not remain running forever.
      await tx.query(`UPDATE jobs SET status='failed',locked_by=NULL,locked_until=NULL,lease_token=NULL,
        last_error='LEASE_EXPIRED',updated_at=$1 WHERE id IN (
          SELECT id FROM jobs WHERE status='running' AND locked_until<=$1 AND attempts>=max_attempts
          AND ($2::uuid IS NULL OR case_id=$2) AND ($3::text IS NULL OR kind=$3) FOR UPDATE SKIP LOCKED
        )`, [instant,opts.caseId ?? null,opts.kind ?? null]);
      const result = await tx.query(`WITH candidate AS (
        SELECT id FROM jobs WHERE attempts<max_attempts
          AND ((status='pending' AND available_at<=$1) OR (status='running' AND locked_until<=$1))
          AND ($2::uuid IS NULL OR case_id=$2) AND ($3::text IS NULL OR kind=$3)
        ORDER BY available_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1
      ) UPDATE jobs SET status='running',attempts=attempts+1,locked_by=$4,lease_token=$5,
        locked_until=$6,updated_at=$1 FROM candidate WHERE jobs.id=candidate.id RETURNING jobs.*`,
      [instant,opts.caseId ?? null,opts.kind ?? null,owner,randomUUID(),new Date(instant.getTime()+opts.leaseMs)]);
      return result.rows[0] ? parseJob(result.rows[0]) : null;
    });
  }
  function checkLeaseInput(id: string, owner: string, token: string) {
    validate(z.uuid(),id); validate(z.string().min(1).max(128),owner); validate(z.uuid(),token);
  }
  async function completeWithExecutor(tx: SqlExecutor, id: string, owner: string, token: string): Promise<boolean> {
    checkLeaseInput(id,owner,token);
    return (await tx.query(`UPDATE jobs SET status='completed',locked_by=NULL,locked_until=NULL,lease_token=NULL,
      last_error=NULL,updated_at=$4 WHERE id=$1 AND locked_by=$2 AND lease_token=$3 AND status='running' AND locked_until>$4`,
    [id,owner,token,now()])).rowCount === 1;
  }
  /** errorCode is a safe classification, never a provider error or request body. */
  async function fail(id: string, owner: string, token: string, errorCode: string, retryDelayMs = 1000): Promise<boolean> {
    checkLeaseInput(id,owner,token); validate(z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/),errorCode);
    validate(z.int().nonnegative().max(3_600_000),retryDelayMs);
    const instant = now();
    return (await db.query(`UPDATE jobs SET status=CASE WHEN attempts>=max_attempts THEN 'failed' ELSE 'pending' END,
      available_at=$6,locked_by=NULL,locked_until=NULL,lease_token=NULL,last_error=$5,updated_at=$4
      WHERE id=$1 AND locked_by=$2 AND lease_token=$3 AND status='running' AND locked_until>$4`,
    [id,owner,token,instant,errorCode,new Date(instant.getTime()+retryDelayMs)])).rowCount === 1;
  }
  async function renewLease(id: string, owner: string, token: string, leaseMs = 60_000): Promise<boolean> {
    checkLeaseInput(id,owner,token); validate(z.int().min(1000).max(900_000),leaseMs);
    const instant = now();
    return (await db.query(`UPDATE jobs SET locked_until=GREATEST(locked_until,$5),updated_at=$4
      WHERE id=$1 AND locked_by=$2 AND lease_token=$3 AND status='running' AND locked_until>$4`,
    [id,owner,token,instant,new Date(instant.getTime()+leaseMs)])).rowCount === 1;
  }
  return { enqueue: (input: EnqueueJob) => db.transaction((tx) => enqueueWithExecutor(tx,input)),
    enqueueWithExecutor,claim,completeWithExecutor,
    complete: (id: string, owner: string, token: string) => completeWithExecutor(db,id,owner,token),fail,renewLease };
}
export type JobsService = ReturnType<typeof createJobsService>;
