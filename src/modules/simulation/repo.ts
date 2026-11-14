import { z } from 'zod';
import { CaseDoc, CopilotRequest, CopilotResponse, MoveRequest, MoveResponse } from '@/contracts';
import type { SqlExecutor } from '@/modules/database';
import { CopilotReply, DirectorTwist, PersonaReply } from '@/modules/llm';
import { AppError } from '@/modules/shared';
import { PersonaStateSnapshot, SubmittedSnapshot } from './snapshot';

const Timestamp = z.union([z.date(),z.iso.datetime({ offset: true })]).transform((date) => new Date(date).toISOString());
export const Checkpoint = z.object({ personaReply: PersonaReply.optional(),copilotReply: CopilotReply.optional(),
  twists: z.array(z.object({ id: z.string(),event: DirectorTwist.shape.event })).default([]) });
export type Checkpoint = z.infer<typeof Checkpoint>;
const Operation = z.object({
  client_msg_id: z.uuid(),case_id: z.uuid(),user_id: z.uuid(),kind: z.enum(['move','copilot']),
  request: z.union([MoveRequest,CopilotRequest]),input_event_id: z.uuid(),
  status: z.enum(['pending','running','completed','cancelled']),lease_token: z.uuid().nullable(),lease_expires_at: Timestamp.nullable(),
  checkpoint: Checkpoint,response: z.union([MoveResponse,CopilotResponse]).nullable(),created_at: Timestamp,updated_at: Timestamp,
});
export type Operation = z.infer<typeof Operation>;

export async function lockCase(tx: SqlExecutor, caseId: string, userId: string) {
  const row = (await tx.query('SELECT id FROM cases WHERE id=$1 AND user_id=$2 FOR UPDATE',[caseId,userId])).rows[0];
  if (!row) throw new AppError('NOT_FOUND',404,'Case not found.');
  z.object({ id: z.uuid() }).parse(row);
}
export async function readOperation(tx: SqlExecutor, id: string) {
  const row = (await tx.query('SELECT * FROM simulation_operations WHERE client_msg_id=$1',[id])).rows[0];
  return row ? Operation.parse(row) : null;
}
export async function readUnfinished(tx: SqlExecutor, caseId: string) {
  const row = (await tx.query("SELECT * FROM simulation_operations WHERE case_id=$1 AND status IN ('running','pending')",[caseId])).rows[0];
  return row ? Operation.parse(row) : null;
}
export async function insertOperation(tx: SqlExecutor, caseId: string, userId: string, kind: 'move'|'copilot', request: MoveRequest|CopilotRequest, inputEventId: string, now: Date) {
  await tx.query(`INSERT INTO simulation_operations(client_msg_id,case_id,user_id,kind,request,input_event_id,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$7)`,[request.clientMsgId,caseId,userId,kind,JSON.stringify(request),inputEventId,now]);
}
export async function claimOperation(tx: SqlExecutor, id: string, token: string, expires: Date, now: Date) {
  const row = (await tx.query(`UPDATE simulation_operations SET status='running',lease_token=$2,lease_expires_at=$3,updated_at=$4
    WHERE client_msg_id=$1 RETURNING *`,[id,token,expires,now])).rows[0];
  const op = Operation.parse(row);
  await tx.query('UPDATE cases SET operation_token=$2,operation_kind=$3,operation_expires_at=$4 WHERE id=$1',[op.case_id,token,op.kind,expires]);
  return op;
}
export async function writeCheckpoint(tx: SqlExecutor, op: Operation, checkpoint: Checkpoint, expires: Date, now: Date) {
  await tx.query('UPDATE simulation_operations SET checkpoint=$2,lease_expires_at=$3,updated_at=$4 WHERE client_msg_id=$1',
    [op.client_msg_id,JSON.stringify(Checkpoint.parse(checkpoint)),expires,now]);
  await tx.query('UPDATE cases SET operation_expires_at=$2 WHERE id=$1',[op.case_id,expires]);
}
export async function releaseOperation(tx: SqlExecutor, id: string, token: string, now: Date) {
  const result = await tx.query(`UPDATE simulation_operations SET status='pending',lease_token=NULL,lease_expires_at=NULL,updated_at=$3
    WHERE client_msg_id=$1 AND lease_token=$2 AND status='running' RETURNING case_id`,[id,token,now]);
  if (result.rows[0]) {
    const { case_id } = z.object({ case_id: z.uuid() }).parse(result.rows[0]);
    await tx.query('UPDATE cases SET operation_token=NULL,operation_kind=NULL,operation_expires_at=NULL WHERE id=$1 AND operation_token=$2',[case_id,token]);
  }
}
export async function completeOperation(tx: SqlExecutor, op: Operation, response: MoveResponse|CopilotResponse, now: Date) {
  await tx.query(`UPDATE simulation_operations SET status='completed',lease_token=NULL,lease_expires_at=NULL,response=$2,updated_at=$3
    WHERE client_msg_id=$1`,[op.client_msg_id,JSON.stringify(response),now]);
  await tx.query('UPDATE cases SET operation_token=NULL,operation_kind=NULL,operation_expires_at=NULL WHERE id=$1',[op.case_id]);
}
export async function cancelOperation(tx: SqlExecutor, op: Operation, now: Date) {
  await tx.query(`UPDATE simulation_operations SET status='cancelled',lease_token=NULL,lease_expires_at=NULL,updated_at=$2
    WHERE client_msg_id=$1`,[op.client_msg_id,now]);
}
export async function start(tx: SqlExecutor, caseId: string, now: Date) {
  await tx.query("UPDATE cases SET status='in_progress',started_at=$2 WHERE id=$1 AND status='ready'",[caseId,now]);
}
export async function writePersonaState(tx: SqlExecutor, caseId: string, personaId: string, state: z.infer<typeof PersonaStateSnapshot>, now: Date) {
  const value = PersonaStateSnapshot.parse(state);
  await tx.query(`UPDATE persona_state SET turn=$3,trust=$4,patience=$5,mood=$6,revealed=$7,outcome=$8,updated_at=$9
    WHERE case_id=$1 AND persona_id=$2`,[caseId,personaId,value.turn,value.trust,value.patience,value.mood,value.revealed,value.outcome,now]);
}
export async function writeDocuments(tx: SqlExecutor, caseId: string, docs: CaseDoc[]) {
  await tx.query('UPDATE cases SET docs=$2 WHERE id=$1',[caseId,JSON.stringify(z.array(CaseDoc).parse(docs))]);
}
export async function isGuest(tx: SqlExecutor, userId: string) {
  return z.object({ is_guest: z.boolean() }).parse((await tx.query('SELECT is_guest FROM users WHERE id=$1',[userId])).rows[0]).is_guest;
}
export async function saveSubmission(tx: SqlExecutor, snapshot: SubmittedSnapshot) {
  await tx.query(`UPDATE cases SET status='submitted',submitted_at=$2,submitted_snapshot=$3,
    operation_token=NULL,operation_kind=NULL,operation_expires_at=NULL WHERE id=$1 AND submitted_snapshot IS NULL`,
  [snapshot.case.id,snapshot.submittedAt,JSON.stringify(SubmittedSnapshot.parse(snapshot))]);
}
export async function loadSubmission(tx: SqlExecutor, caseId: string): Promise<SubmittedSnapshot|null> {
  const row = (await tx.query('SELECT submitted_snapshot FROM cases WHERE id=$1',[caseId])).rows[0];
  return row?.submitted_snapshot ? SubmittedSnapshot.parse(row.submitted_snapshot) : null;
}
