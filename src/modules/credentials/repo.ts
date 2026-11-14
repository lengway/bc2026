import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { SqlExecutor } from '@/modules/database';
import { AppError } from '@/modules/shared';
import type { SubmittedSnapshot } from '@/modules/simulation';

const RecordSchema=z.object({id:z.uuid(),case_id:z.uuid(),user_id:z.uuid(),slug:z.string(),skill:z.string(),issued_at:z.coerce.date(),revoked_at:z.coerce.date().nullable()});
export function parseCertificate(input:unknown) {
  const row=RecordSchema.parse(input);
  return {id:row.id,caseId:row.case_id,userId:row.user_id,slug:row.slug,skill:row.skill,issuedAt:row.issued_at.toISOString(),revokedAt:row.revoked_at};
}
export type CertificateRecord=ReturnType<typeof parseCertificate>;
export async function canIssue(db:SqlExecutor,userId:string):Promise<boolean> {
  const result=await db.query('SELECT id FROM users WHERE id=$1 AND (email_verified_at IS NOT NULL OR is_guest=true)',[userId]);
  return result.rows.length>0;
}
export async function findOwnedSlug(db:SqlExecutor,caseId:string,userId:string):Promise<{slug:string;revokedAt:Date|null}|null> {
  const result=await db.query('SELECT c.slug,c.revoked_at AS "revokedAt" FROM certificates c JOIN cases k ON k.id=c.case_id AND k.user_id=c.user_id JOIN users u ON u.id=c.user_id WHERE c.case_id=$1 AND c.user_id=$2 AND k.status=$3 AND (u.email_verified_at IS NOT NULL OR u.is_guest=true)',[caseId,userId,'evaluated']);
  return result.rows[0]?z.object({slug:z.string(),revokedAt:z.coerce.date().nullable()}).parse(result.rows[0]):null;
}
export async function issue(tx:SqlExecutor,snapshot:SubmittedSnapshot,now:Date):Promise<CertificateRecord> {
  if(!await canIssue(tx,snapshot.case.userId)) throw new AppError('FORBIDDEN',403,'Confirm your email before publishing a certificate.');
  const ownership=z.object({user_id:z.uuid(),status:z.string()}).parse((await tx.query('SELECT user_id,status FROM cases WHERE id=$1',[snapshot.case.id])).rows[0]);
  if(ownership.user_id!==snapshot.case.userId||ownership.status!=='evaluated') throw new AppError('VALIDATION',409,'Only an evaluated case can issue a certificate.');
  for(let attempt=0;attempt<5;attempt++) {
    const slug=randomBytes(8).toString('base64url').slice(0,10);
    const result=await tx.query(`INSERT INTO certificates(case_id,user_id,slug,skill,issued_at) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT DO NOTHING RETURNING *`,[snapshot.case.id,snapshot.case.userId,slug,'Sales',now]);
    if(result.rows[0]) return parseCertificate(result.rows[0]);
    const existing=await tx.query('SELECT * FROM certificates WHERE case_id=$1',[snapshot.case.id]);
    if(existing.rows[0]) return parseCertificate(existing.rows[0]);
  }
  throw new Error('Unable to allocate certificate identifier');
}
export async function findBySlug(db:SqlExecutor,slug:string) {
  const result=await db.query('SELECT c.*,u.display_name FROM certificates c JOIN users u ON u.id=c.user_id WHERE c.slug=$1 AND c.revoked_at IS NULL AND (u.email_verified_at IS NOT NULL OR u.is_guest=true)',[slug]);
  if(!result.rows[0]) return null;
  return {certificate:parseCertificate(result.rows[0]),holderName:z.object({display_name:z.string().nullable()}).parse(result.rows[0]).display_name};
}
