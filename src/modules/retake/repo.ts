import { z } from "zod";
import { CaseType } from "@/contracts/case";
import { RetakeResult } from "@/contracts/retake";
import type { SqlExecutor } from "@/modules/database";
import { SubmittedSnapshot } from "@/modules/simulation";
import { AppError } from "@/modules/shared";
import { buildRetakeContext } from "./context";

const Source = z.object({
  type: CaseType,
  status: z.string(),
  accuracy: z.number().nullable(),
  criterion: z.string().nullable(),
  snapshot: z.unknown(),
});

export async function readSource(
  db: SqlExecutor,
  userId: string,
  caseId: string,
  eventId: string,
) {
  const { rows } = await db.query(
    `SELECT c.type,c.status,e.accuracy,m.rubric_ref AS criterion,c.submitted_snapshot AS snapshot
    FROM cases c
    LEFT JOIN evaluations e ON e.case_id=c.id
    LEFT JOIN move_reviews m ON m.case_id=c.id AND m.event_id=$3 AND m.assessment_status='assessed'
    WHERE c.id=$1 AND c.user_id=$2`,
    [caseId, userId, eventId],
  );
  if (!rows[0]) throw new AppError("NOT_FOUND", 404, "Case not found.");
  const { type, status, accuracy, criterion, snapshot } = Source.parse(rows[0]);
  if (type === "prep" || status !== "evaluated" || accuracy === null || !criterion) return null;
  return { criterion, snapshot };
}

export async function readContext(
  db: SqlExecutor,
  caseId: string,
  eventId: string,
  source: NonNullable<Awaited<ReturnType<typeof readSource>>>,
) {
  const snapshot = SubmittedSnapshot.safeParse(source.snapshot);
  if (!snapshot.success) return null;
  // The original buyer prompt included the learner event as its last history item.
  const { rows } = await db.query(
    `SELECT input->'state' AS state FROM llm_calls
    WHERE case_id=$1 AND prompt_id='persona.reply' AND ok=true
      AND input->'history'->(-1)->>'id'=$2::text
    ORDER BY created_at DESC LIMIT 1`,
    [caseId, eventId],
  );
  return buildRetakeContext(
    snapshot.data,
    eventId,
    source.criterion,
    rows[0]?.state,
  );
}

const Attempt = z.object({
  answer: z.string(),
  result: RetakeResult.nullable(),
  lease_expires_at: z.coerce.date().nullable(),
});

export async function readAttempt(db: SqlExecutor, eventId: string) {
  const { rows } = await db.query(
    "SELECT answer,result,lease_expires_at FROM move_retakes WHERE source_event_id=$1",
    [eventId],
  );
  return rows[0] ? Attempt.parse(rows[0]) : null;
}

export async function lockQuota(db: SqlExecutor, userId: string) {
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,10))", [
    userId,
  ]);
}

const RETAKE_LIMIT = 3;
export const RETAKE_ATTEMPT_LIMIT = 6;
export const RETAKE_WINDOW_MS = 7 * 86_400_000;

export function retakeAttemptKey(userId: string) {
  return `practice:retake:${userId}`;
}

export async function readQuota(db: SqlExecutor, userId: string, now: Date) {
  const since = new Date(now.getTime() - RETAKE_WINDOW_MS);
  const { rows } = await db.query(
    `WITH attempts AS (
      SELECT count, window_start FROM rate_limits WHERE key=$4 AND window_start>$2
    )
    SELECT count(*)::int AS used,
      min(coalesce(completed_at + interval '168 hours',lease_expires_at)) AS next,
      coalesce((SELECT count FROM attempts),0) AS "attemptCount",
      (SELECT window_start FROM attempts) AS "attemptStart"
      FROM move_retakes WHERE user_id=$1 AND (completed_at>$2 OR lease_expires_at>$3)`,
    [userId, since, now, retakeAttemptKey(userId)],
  );
  const { used, next, attemptCount, attemptStart } = z
    .object({
      used: z.number(),
      next: z.coerce.date().nullable(),
      attemptCount: z.number(),
      attemptStart: z.coerce.date().nullable(),
    })
    .parse(rows[0]);
  const retakeReset = used >= RETAKE_LIMIT ? next : null;
  const attemptReset =
    attemptCount >= RETAKE_ATTEMPT_LIMIT && attemptStart
      ? new Date(attemptStart.getTime() + RETAKE_WINDOW_MS)
      : null;
  const nextStart = Math.max(
    retakeReset?.getTime() ?? -Infinity,
    attemptReset?.getTime() ?? -Infinity,
  );
  return {
    remaining: Math.max(
      0,
      Math.min(RETAKE_LIMIT - used, RETAKE_ATTEMPT_LIMIT - attemptCount),
    ),
    nextAvailableAt: Number.isFinite(nextStart)
      ? new Date(nextStart).toISOString()
      : null,
  };
}

export async function reserve(
  db: SqlExecutor,
  data: {
    eventId: string;
    caseId: string;
    userId: string;
    answer: string;
    token: string;
    expiresAt: Date;
    now: Date;
  },
) {
  const result = await db.query(
    `INSERT INTO move_retakes(source_event_id,case_id,user_id,answer,lease_token,lease_expires_at)
    VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(source_event_id) DO UPDATE SET answer=excluded.answer,
      lease_token=excluded.lease_token,lease_expires_at=excluded.lease_expires_at
    WHERE move_retakes.lease_expires_at <= $7`,
    [
      data.eventId,
      data.caseId,
      data.userId,
      data.answer,
      data.token,
      data.expiresAt,
      data.now,
    ],
  );
  return result.rowCount === 1;
}

export async function publish(
  db: SqlExecutor,
  eventId: string,
  token: string,
  result: RetakeResult,
  now: Date,
) {
  const updated = await db.query(
    `UPDATE move_retakes SET result=$3,completed_at=$4,lease_token=NULL,lease_expires_at=NULL
    WHERE source_event_id=$1 AND lease_token=$2 AND lease_expires_at>$4`,
    [eventId, token, JSON.stringify(result), now],
  );
  return updated.rowCount === 1;
}

export async function release(db: SqlExecutor, eventId: string, token: string) {
  await db.query(
    "DELETE FROM move_retakes WHERE source_event_id=$1 AND lease_token=$2",
    [eventId, token],
  );
}
