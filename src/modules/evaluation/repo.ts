import { z } from 'zod';
import { CertificateTranscriptEvent, MoveReview, ReviewResponse } from '@/contracts';
import type { SqlExecutor } from '@/modules/database';

export async function readReviewState(db: SqlExecutor, id: string, userId?: string) {
  const { rows } = await db.query(`SELECT user_id AS "userId",
    CASE WHEN c.status='submitted' AND EXISTS (
      SELECT 1 FROM jobs j WHERE j.case_id=c.id AND j.kind='case.evaluate' AND j.status='failed'
    ) THEN 'failed' ELSE c.status END AS status
    FROM cases c WHERE id=$1 AND ($2::uuid IS NULL OR user_id=$2)`, [id, userId ?? null]);
  return rows[0] ? z.object({ userId: z.uuid(), status: z.enum(['generating','ready','in_progress','submitted','evaluated','failed']) }).parse(rows[0]) : null;
}

export async function readReview(db: SqlExecutor, id: string): Promise<ReviewResponse> {
  const evaluation = (await db.query(`SELECT case_id AS "caseId",accuracy,label_counts AS "labelCounts",
    ai_dependency AS "aiDependency",trap_caught AS "trapCaught",outcome,top_move_ids AS "topIds",summary,skills,
    assistance,ai_use_skill AS "aiUseSkill",trap_result AS "trapResult",score_audit AS "scoreAudit",
    process_observations AS "processObservations",trust_curve AS "trustCurve"
    FROM evaluations WHERE case_id=$1`, [id])).rows[0];
  const moves = MoveReview.array().parse((await db.query(`SELECT r.event_id AS "eventId",e.seq,e.content AS "userText",r.label,r.why,
    r.better_move AS "betterMove",r.inner_thought AS "innerThought",r.trust_after AS "trustAfter",r.rubric_ref AS "rubricRef",
    r.points,r.evidence,r.assessment_status AS "assessmentStatus"
    FROM move_reviews r JOIN events e ON e.id=r.event_id AND e.case_id=r.case_id WHERE r.case_id=$1 ORDER BY e.seq`, [id])).rows);
  const topIds = z.array(z.uuid()).parse(evaluation?.topIds);
  const byId = new Map(moves.map((move) => [move.eventId, move]));
  const transcript = (await db.query(`SELECT id,seq,actor,type,content,
    created_at AS "createdAt" FROM events WHERE case_id=$1 AND is_public=true ORDER BY seq`, [id])).rows
    .map((event) => CertificateTranscriptEvent.parse({ ...event,
      createdAt: event.createdAt instanceof Date ? event.createdAt.toISOString() : event.createdAt }));
  return ReviewResponse.parse({ evaluation: { ...evaluation, topMoves: topIds.map((eventId) => byId.get(eventId)) }, moves, transcript });
}

export async function publishReview(tx: SqlExecutor, { evaluation, moves }: ReviewResponse, at: Date) {
  const id = evaluation.caseId;
  const changed = await tx.query("UPDATE cases SET status='evaluated' WHERE id=$1 AND status='submitted'", [id]);
  if (changed.rowCount !== 1) throw new Error('Case is no longer awaiting evaluation');
  await tx.query(`INSERT INTO evaluations(case_id,accuracy,label_counts,ai_dependency,trap_caught,outcome,top_move_ids,
    summary,skills,assistance,ai_use_skill,trap_result,score_audit,process_observations,trust_curve,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, [
    id, evaluation.accuracy, JSON.stringify(evaluation.labelCounts), evaluation.aiDependency, evaluation.trapCaught,
    evaluation.outcome, evaluation.topMoves.map((move) => move.eventId), evaluation.summary, JSON.stringify(evaluation.skills),
    JSON.stringify(evaluation.assistance), JSON.stringify(evaluation.aiUseSkill), evaluation.trapResult,
    JSON.stringify(evaluation.scoreAudit), JSON.stringify(evaluation.processObservations), JSON.stringify(evaluation.trustCurve), at,
  ]);
  for (const move of moves) await tx.query(`INSERT INTO move_reviews(event_id,case_id,label,why,better_move,
    inner_thought,rubric_ref,trust_after,points,evidence,assessment_status)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [
    move.eventId, id, move.label, move.why, move.betterMove, move.innerThought, move.rubricRef,
    move.trustAfter, move.points, JSON.stringify(move.evidence), move.assessmentStatus,
  ]);
}

export async function evaluationLease(db: SqlExecutor, jobId: string, caseId: string, owner: string, token: string, at: Date) {
  const { rows } = await db.query(`SELECT status FROM jobs WHERE id=$1 AND case_id=$2 AND kind='case.evaluate'
    AND (status='completed' OR (status='running' AND locked_by=$3 AND lease_token=$4 AND locked_until>$5))`,
  [jobId, caseId, owner, token, at]);
  return rows[0] ? z.object({ status: z.enum(['running', 'completed']) }).parse(rows[0]).status : null;
}

export async function reconcileFailed(db: SqlExecutor) {
  const result = await db.query(`UPDATE cases c SET status='failed' WHERE c.status='submitted' AND EXISTS (
    SELECT 1 FROM jobs j WHERE j.case_id=c.id AND j.kind='case.evaluate' AND j.status='failed'
  )`);
  return result.rowCount ?? 0;
}
